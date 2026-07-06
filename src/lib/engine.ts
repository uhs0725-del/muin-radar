// 포화도 진단 엔진 (서버 전용). Python engine.py 검증 로직을 TS로 포팅.
// 검증된 사실: 카카오 로컬 API는 리뷰/평점 미제공 → 점수는 매장 밀도 기반.
//             카카오 coord2regioncode 코드 == MOIS 행정동 코드(인구표 키).

import { CATEGORY_MAP, type CategoryDef, type Measurable } from "./categories";
import populationRaw from "@/data/population.json";
import calibrationRaw from "@/data/calibration.json";
import {
  nearestTrdar,
  trdarsWithin,
  flpopOf,
  salesOf,
  storesOf,
  SEOUL_INDUSTY,
  SEOUL_ASOF,
  type SeoulMatch,
} from "./seoul";

const POPULATION = populationRaw as unknown as Record<string, [number, number]>; // code -> [pop, sede]

interface CalibCat {
  n: number;
  breakpoints: Record<string, number>;
  yellow_at: number;
  red_at: number;
  mean: number;
}
// 반경별 {반경:{업종:CalibCat}} 또는 구버전 flat {업종:CalibCat}
const CALIB_RAW = calibrationRaw as unknown as
  | Record<string, Record<string, CalibCat>>
  | Record<string, CalibCat>;

function calibForRadius(radiusM: number): Record<string, CalibCat> | null {
  const raw = CALIB_RAW as Record<string, unknown>;
  if (!raw || Object.keys(raw).length === 0) return null;
  // flat(구버전): 업종키가 최상위
  if ("studycafe" in raw) return raw as Record<string, CalibCat>;
  const key = String(radiusM);
  if (key in raw) return raw[key] as Record<string, CalibCat>;
  const avail = Object.keys(raw)
    .filter((k) => /^\d+$/.test(k))
    .map(Number);
  if (!avail.length) return null;
  const nearest = avail.reduce((a, b) =>
    Math.abs(b - radiusM) < Math.abs(a - radiusM) ? b : a,
  );
  return raw[String(nearest)] as Record<string, CalibCat>;
}

// 서울 유동인구 캘리브: calibration.json 안의 seoulFlpop 섹션(radius→cat→CalibCat).
// per-유동인구 지표(count/유동인구*10000)의 서울 내 분포 백분위. 없으면 null.
function seoulFlpopCalib(radiusM: number): Record<string, CalibCat> | null {
  const raw = CALIB_RAW as Record<string, unknown>;
  const sf = raw?.seoulFlpop as Record<string, Record<string, CalibCat>> | undefined;
  if (!sf || Object.keys(sf).length === 0) return null;
  const key = String(radiusM);
  if (key in sf) return sf[key];
  const avail = Object.keys(sf)
    .filter((k) => /^\d+$/.test(k))
    .map(Number);
  if (!avail.length) return null;
  const nearest = avail.reduce((a, b) =>
    Math.abs(b - radiusM) < Math.abs(a - radiusM) ? b : a,
  );
  return sf[String(nearest)];
}

function percentileOf(v: number, breakpoints: Record<string, number>): number {
  const bps = Object.entries(breakpoints)
    .map(([p, val]) => [parseInt(p, 10), val] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (v <= bps[0][1]) return 0;
  for (let i = 0; i < bps.length - 1; i++) {
    const [loP, loV] = bps[i];
    const [hiP, hiV] = bps[i + 1];
    if (loV <= v && v <= hiV && hiV > loV) {
      return loP + ((hiP - loP) * (v - loV)) / (hiV - loV);
    }
  }
  return 100;
}

// Vercel 환경변수 우선, 없으면 fallback(Private 레포). 나중에 env로 옮기고 이 기본값 제거 권장.
const KEY = process.env.KAKAO_REST_KEY || "1d26b6e9dffe6908aabcf78aaab683f4";
const BASE = "https://dapi.kakao.com/v2/local";

async function kakao(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${BASE}/${path}?${qs.toString()}`, {
    headers: { Authorization: `KakaoAK ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`kakao ${path} ${res.status}`);
  }
  return res.json();
}

export interface Geo {
  x: string;
  y: string;
  norm: string;
}

export async function geocode(address: string): Promise<Geo | null> {
  let d = await kakao("search/address.json", { query: address });
  let docs = d.documents || [];
  if (!docs.length) {
    d = await kakao("search/keyword.json", { query: address, size: 1 });
    docs = d.documents || [];
    if (!docs.length) return null;
  }
  const t = docs[0];
  return { x: t.x, y: t.y, norm: t.address_name || t.place_name };
}

export interface Region {
  code: string;
  dong: string;
  gu: string;
  si: string;
  full: string;
}

export async function regionOf(x: string, y: string): Promise<Region | null> {
  const d = await kakao("geo/coord2regioncode.json", { x, y });
  for (const doc of d.documents || []) {
    if (doc.region_type === "H") {
      return {
        code: doc.code,
        dong: doc.region_3depth_name,
        gu: doc.region_2depth_name,
        si: doc.region_1depth_name,
        full: doc.address_name,
      };
    }
  }
  return null;
}

async function searchPage(
  query: string | null,
  categoryCode: string | null,
  x: string,
  y: string,
  radius: number,
  page: number,
) {
  const params: Record<string, string | number> = {
    x,
    y,
    radius,
    size: 15,
    page,
  };
  let path: string;
  if (categoryCode) {
    path = "search/category.json";
    params.category_group_code = categoryCode;
  } else {
    path = "search/keyword.json";
    params.query = query as string;
  }
  return kakao(path, params);
}

// 반경 내 매장 1건 — 이름 + 진단 중심으로부터의 거리(m).
export interface Store {
  id: string;
  name: string;
  distanceM: number | null; // 카카오 documents.distance (검색 중심 x,y 기준)
}

// 키워드 검색 → category_name 필터로 매장 수집(중복제거). 카카오 페이지 상한 45.
async function collectFiltered(
  query: string | null,
  categoryCode: string | null,
  x: string,
  y: string,
  radius: number,
  keepCategory: string[],
): Promise<Map<string, Store>> {
  const stores = new Map<string, Store>();
  for (let page = 1; page <= 3; page++) {
    const d = await searchPage(query, categoryCode, x, y, radius, page);
    for (const doc of d.documents || []) {
      const cn: string = doc.category_name || "";
      if (keepCategory.length && !keepCategory.some((k) => cn.includes(k))) continue;
      const dist = doc.distance !== undefined && doc.distance !== "" ? Number(doc.distance) : null;
      stores.set(doc.id, {
        id: doc.id,
        name: doc.place_name || "",
        distanceM: Number.isFinite(dist as number) ? (dist as number) : null,
      });
    }
    if (d.meta?.is_end ?? true) break;
  }
  return stores;
}

export interface CategoryResult {
  category: string;
  label: string;
  measurable: Measurable;
  note?: string;
  count: number | null;
  sample: string[];
  // 상세 리포트용 — 반경 내 경쟁 매장 전체(최대 45, 거리 오름차순). 무료 응답엔 미포함.
  stores?: Store[];
  score?: ScoreResult;
}

export async function collectCompetitors(
  def: CategoryDef,
  x: string,
  y: string,
  radius: number,
  withStores = false, // true면 stores(전체 리스트, 거리 포함) 채움 — 상세 리포트용
): Promise<CategoryResult> {
  if (def.measurable === false) {
    return {
      category: def.key,
      label: def.label,
      measurable: false,
      note: def.note,
      count: null,
      sample: [],
    };
  }
  const merged = new Map<string, Store>();
  let catTotal: number | null = null;

  if (def.categoryCode) {
    // 편의점(CS2): 카테고리코드=필터(오탐 없음). total_count는 정확(45 초과 포함).
    // 리스트는 페이지네이션으로 최대 45개까지 수집(거리 포함).
    for (let page = 1; page <= 3; page++) {
      const d = await searchPage(null, def.categoryCode, x, y, radius, page);
      if (page === 1) catTotal = d.meta?.total_count ?? 0;
      for (const doc of d.documents || []) {
        const dist =
          doc.distance !== undefined && doc.distance !== "" ? Number(doc.distance) : null;
        merged.set(doc.id, {
          id: doc.id,
          name: doc.place_name || "",
          distanceM: Number.isFinite(dist as number) ? (dist as number) : null,
        });
      }
      if (d.meta?.is_end ?? true) break;
    }
  }
  for (const kw of def.keywords) {
    const found = await collectFiltered(kw, null, x, y, radius, def.keepCategory);
    found.forEach((v, k) => merged.set(k, v));
  }

  const count = catTotal !== null ? catTotal : merged.size;
  const storeList = Array.from(merged.values()).sort(
    (a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
  );

  return {
    category: def.key,
    label: def.label,
    measurable: def.measurable,
    note: def.note,
    count,
    sample: storeList.slice(0, 6).map((s) => s.name),
    ...(withStores ? { stores: storeList } : {}),
  };
}

export interface ScoreResult {
  score: number;
  metric: "national_percentile" | "density_only" | "seoul_dual";
  light: "green" | "yellow" | "red";
  verdict: string;
  storesPer10kPop?: number;
  nationalTopPct?: number;
  densityPerKm2: number;
  calibration: string;
  // 서울 전용 — 유동인구 반영 이중 지표(있을 때만 채워짐)
  seoul?: {
    trdarName: string;
    flpopTot: number; // 최근접 상권 총 유동인구
    storesPer10kFlpop: number; // 매장수 / 유동인구 * 10000
    flpopTopPct: number; // 유동인구 대비 상위 %
    residTopPct: number; // 거주인구 대비 상위 % (기존)
  };
}

const VERDICT: Record<string, string> = {
  red: "포화 — 신규 진입 회피 권장",
  yellow: "주의 — 차별화 없으면 위험",
  green: "여유 — 진입 검토 가능",
};

export function saturationScore(
  count: number,
  radiusM: number,
  pop: number | null,
  catKey?: string,
  seoulMatch?: SeoulMatch | null, // 서울이면 최근접 상권 → 유동인구 이중 지표 병행
): ScoreResult {
  const areaKm2 = Math.PI * (radiusM / 1000) ** 2;
  const density = areaKm2 ? count / areaKm2 : 0;
  const calib = calibForRadius(radiusM);
  const cinfo = catKey && calib ? calib[catKey] : undefined;

  if (pop && pop > 0 && cinfo) {
    const per10k = (count / pop) * 10000;
    const bp = cinfo.breakpoints;
    const residPctile = Math.round(percentileOf(per10k, bp) * 10) / 10;
    const yellowAt = bp["60"] ?? 0;
    const redAt = bp["80"] ?? 0;
    let residLight: "green" | "yellow" | "red";
    if (per10k >= redAt && redAt > 0) residLight = "red";
    else if (per10k >= yellowAt && yellowAt > 0) residLight = "yellow";
    else residLight = "green";
    const residTopPct = Math.round((100 - residPctile) * 10) / 10;

    // 서울: 최근접 상권 유동인구로 이중 지표 계산 → 거주50%+유동50% 평균.
    const flpop =
      seoulMatch && catKey ? flpopOf(seoulMatch.trdarCd) : null;
    const flCalib = seoulMatch && catKey ? seoulFlpopCalib(radiusM) : null;
    const flInfo = flCalib && catKey ? flCalib[catKey] : undefined;
    if (seoulMatch && flpop && flpop.tot > 0 && flInfo) {
      const perFl = (count / flpop.tot) * 10000;
      const fbp = flInfo.breakpoints;
      const flPctile = Math.round(percentileOf(perFl, fbp) * 10) / 10;
      const flYellow = fbp["60"] ?? 0;
      const flRed = fbp["80"] ?? 0;
      let flLight: "green" | "yellow" | "red";
      if (perFl >= flRed && flRed > 0) flLight = "red";
      else if (perFl >= flYellow && flYellow > 0) flLight = "yellow";
      else flLight = "green";
      const flTopPct = Math.round((100 - flPctile) * 10) / 10;

      // 최종 = 두 백분위 평균. 신호등은 평균 백분위 기준(p60/p80).
      const avgPctile = Math.round(((residPctile + flPctile) / 2) * 10) / 10;
      let light: "green" | "yellow" | "red";
      if (residLight === "red" || flLight === "red") light = "red";
      else if (residLight === "yellow" || flLight === "yellow") light = "yellow";
      else light = "green";
      return {
        score: avgPctile,
        metric: "seoul_dual",
        light,
        verdict: VERDICT[light],
        storesPer10kPop: Math.round(per10k * 10) / 10,
        nationalTopPct: residTopPct,
        densityPerKm2: Math.round(density * 10) / 10,
        calibration: `resid n=${cinfo.n} / flpop n=${flInfo.n}`,
        seoul: {
          trdarName: seoulMatch.name,
          flpopTot: flpop.tot,
          storesPer10kFlpop: Math.round(perFl * 10) / 10,
          flpopTopPct: flTopPct,
          residTopPct,
        },
      };
    }

    return {
      score: residPctile,
      metric: "national_percentile",
      light: residLight,
      verdict: VERDICT[residLight],
      storesPer10kPop: Math.round(per10k * 10) / 10,
      nationalTopPct: residTopPct,
      densityPerKm2: Math.round(density * 10) / 10,
      calibration: `n=${cinfo.n}`,
    };
  }

  // 폴백: 캘리브/인구 없을 때 면적당 밀도
  const score = Math.round((100 / (1 + Math.exp(-(density - 7) / 3))) * 10) / 10;
  let light: "green" | "yellow" | "red";
  if (score >= 70) light = "red";
  else if (score >= 40) light = "yellow";
  else light = "green";
  return {
    score,
    metric: "density_only",
    light,
    verdict: VERDICT[light],
    densityPerKm2: Math.round(density * 10) / 10,
    calibration: "uncalibrated",
  };
}

export interface SeoulContext {
  inSeoul: boolean;
  trdarName?: string;
  trdarDistanceM?: number;
  flpopTot?: number; // 최근접 상권 총 유동인구(최신 분기)
  flpopAsOf?: string;
}

export interface Diagnosis {
  ok: boolean;
  error?: string;
  addressInput: string;
  addressNorm?: string;
  region?: Region | null;
  population?: { pop: number; sede: number } | null;
  radiusM: number;
  mode: string;
  results: CategoryResult[];
  seoul?: SeoulContext; // 서울이면 유동인구 반영 배지용(세부 수치는 유료 리포트)
}

export async function diagnose(
  address: string,
  catKeys: string[],
  radius = 1000,
  withStores = false,
): Promise<Diagnosis> {
  const geo = await geocode(address);
  if (!geo) {
    return {
      ok: false,
      error: "주소를 찾을 수 없습니다. 동/도로명 또는 지하철역명으로 다시 시도해 보세요.",
      addressInput: address,
      radiusM: radius,
      mode: "",
      results: [],
    };
  }
  const region = await regionOf(geo.x, geo.y);
  const popRow = region ? POPULATION[region.code] : undefined;
  const popinfo = popRow ? { pop: popRow[0], sede: popRow[1] } : null;

  // 서울이면 최근접 상권 매칭(유동인구 이중 지표용). 서울 밖이면 null → 기존 동작 그대로.
  const seoulMatch = nearestTrdar(geo.x, geo.y);
  const seoulFl = seoulMatch ? flpopOf(seoulMatch.trdarCd) : null;

  const results: CategoryResult[] = [];
  for (const key of catKeys) {
    const def = CATEGORY_MAP[key];
    if (!def) continue;
    const comp = await collectCompetitors(def, geo.x, geo.y, radius, withStores);
    if (comp.count !== null) {
      comp.score = saturationScore(
        comp.count,
        radius,
        popinfo ? popinfo.pop : null,
        key,
        seoulMatch,
      );
    }
    results.push(comp);
  }

  const seoulSuffix = seoulMatch
    ? ` · 서울 상권 매칭: ${seoulMatch.name}(${seoulMatch.distanceM}m) · 유동인구 반영 ON`
    : "";
  const mode = popinfo
    ? `인구 정규화 ON · 중심 행정동 ${region?.dong} 인구 ${popinfo.pop.toLocaleString()}명 / ${popinfo.sede.toLocaleString()}세대${seoulSuffix}`
    : `density-only · 행정동 인구 미매칭${seoulSuffix}`;

  const seoulCtx: SeoulContext = seoulMatch
    ? {
        inSeoul: true,
        trdarName: seoulMatch.name,
        trdarDistanceM: seoulMatch.distanceM,
        flpopTot: seoulFl?.tot,
        flpopAsOf: SEOUL_ASOF.flpop,
      }
    : { inSeoul: false };

  return {
    ok: true,
    addressInput: address,
    addressNorm: geo.norm,
    region,
    population: popinfo,
    radiusM: radius,
    mode,
    results,
    seoul: seoulCtx,
  };
}

// ── 상세 리포트 전용: 4개 반경 비교 ─────────────────────────────
export const REPORT_RADII = [500, 1000, 2000, 3000] as const;

export interface RadiusRow {
  radiusM: number;
  count: number | null;
  storesPer10kPop?: number;
  nationalTopPct?: number;
  light: "green" | "yellow" | "red" | null;
}

export interface CategoryReport {
  category: string;
  label: string;
  measurable: Measurable;
  note?: string;
  // 사용자가 선택한 반경 기준 상세(전체 매장 리스트 포함)
  primary: CategoryResult;
  // 4개 반경 비교 행
  byRadius: RadiusRow[];
}

// ── 서울 프리미엄 섹션(유료 리포트 전용) ─────────────────────────
export interface SeoulTrdarInfo {
  trdarName: string;
  distanceM: number;
  adstrd: string;
  flpopTot: number;
  flpopMale: number;
  flpopFemale: number;
  topAges: { label: string; value: number }[]; // 상위 2개 연령대
  flpopAsOf: string;
}
export interface SeoulCatDetail {
  category: string;
  label: string;
  hasSales: boolean; // 서울 62종 매핑 존재
  approx: boolean; // 근사 매핑 여부
  basis: string; // 근사 기준(정직 표기)
  // hasSales일 때만
  quarterSalesAmt?: number; // 상권×업종 분기 카드매출 추정(원)
  monthlySalesAmt?: number; // ÷3 월 환산(원)
  salesCnt?: number; // 분기 결제 건수
  stores?: number; // 점포수
  perStoreQuarterAmt?: number; // 점포당 분기 추정매출(핵심)
  perStoreMonthlyAmt?: number; // 점포당 월 추정매출(시뮬레이터 프리필)
  franchise?: number;
  openRate?: number; // 개업률(%)
  salesAsOf?: string;
  storesAsOf?: string;
}
export interface SeoulPremium {
  trdar: SeoulTrdarInfo;
  categories: SeoulCatDetail[];
}

export interface DetailedReport {
  ok: boolean;
  error?: string;
  addressInput: string;
  addressNorm?: string;
  region?: Region | null;
  population?: { pop: number; sede: number } | null;
  radiusM: number;
  mode: string;
  generatedAt: string;
  categories: CategoryReport[];
  seoul?: SeoulPremium | null; // 서울이면 채워짐
}

// 반경 4개 × 업종 루프. 카카오 호출이 많아 무료 진단과 분리(유료 게이트 뒤에서만 호출).
export async function detailedReport(
  address: string,
  catKeys: string[],
  radius = 1000,
): Promise<DetailedReport> {
  const geo = await geocode(address);
  if (!geo) {
    return {
      ok: false,
      error: "주소를 찾을 수 없습니다.",
      addressInput: address,
      radiusM: radius,
      mode: "",
      generatedAt: new Date().toISOString(),
      categories: [],
    };
  }
  const region = await regionOf(geo.x, geo.y);
  const popRow = region ? POPULATION[region.code] : undefined;
  const popinfo = popRow ? { pop: popRow[0], sede: popRow[1] } : null;
  const pop = popinfo ? popinfo.pop : null;

  const seoulMatch = nearestTrdar(geo.x, geo.y);

  const categories: CategoryReport[] = [];
  for (const key of catKeys) {
    const def = CATEGORY_MAP[key];
    if (!def) continue;

    // 선택 반경 기준 상세(매장 전체 리스트 포함)
    const primary = await collectCompetitors(def, geo.x, geo.y, radius, true);
    if (primary.count !== null) {
      primary.score = saturationScore(primary.count, radius, pop, key, seoulMatch);
    }

    // 4개 반경 비교
    const byRadius: RadiusRow[] = [];
    for (const r of REPORT_RADII) {
      if (def.measurable === false) {
        byRadius.push({ radiusM: r, count: null, light: null });
        continue;
      }
      // 선택 반경은 이미 계산한 값 재사용(카카오 호출 절약)
      const comp =
        r === radius ? primary : await collectCompetitors(def, geo.x, geo.y, r, false);
      const score =
        comp.count !== null ? saturationScore(comp.count, r, pop, key, seoulMatch) : undefined;
      byRadius.push({
        radiusM: r,
        count: comp.count,
        storesPer10kPop: score?.storesPer10kPop,
        nationalTopPct: score?.nationalTopPct,
        light: score?.light ?? null,
      });
    }

    categories.push({
      category: def.key,
      label: def.label,
      measurable: def.measurable,
      note: def.note,
      primary,
      byRadius,
    });
  }

  // 서울 프리미엄 섹션(카드매출/점포/유동인구)
  const seoulPremium = seoulMatch ? buildSeoulPremium(seoulMatch, catKeys) : null;

  const seoulSuffix = seoulMatch
    ? ` · 서울 상권: ${seoulMatch.name}(${seoulMatch.distanceM}m) · 유동인구 반영 ON`
    : "";
  const mode = popinfo
    ? `인구 정규화 ON · 중심 행정동 ${region?.dong} 인구 ${popinfo.pop.toLocaleString()}명 / ${popinfo.sede.toLocaleString()}세대${seoulSuffix}`
    : `density-only · 행정동 인구 미매칭${seoulSuffix}`;

  return {
    ok: true,
    addressInput: address,
    addressNorm: geo.norm,
    region,
    population: popinfo,
    radiusM: radius,
    mode,
    generatedAt: new Date().toISOString(),
    categories,
    seoul: seoulPremium,
  };
}

// 서울 상권 카드매출/점포/유동인구 프리미엄 섹션 구성.
function buildSeoulPremium(match: SeoulMatch, catKeys: string[]): SeoulPremium {
  const fl = flpopOf(match.trdarCd);
  const ageLabels: Record<string, string> = {
    age10: "10대",
    age20: "20대",
    age30: "30대",
    age40: "40대",
    age50: "50대",
    age60: "60대+",
  };
  let topAges: { label: string; value: number }[] = [];
  if (fl) {
    topAges = (
      ["age10", "age20", "age30", "age40", "age50", "age60"] as const
    )
      .map((k) => ({ label: ageLabels[k], value: fl[k] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 2);
  }
  const trdar: SeoulTrdarInfo = {
    trdarName: match.name,
    distanceM: match.distanceM,
    adstrd: match.adstrd,
    flpopTot: fl?.tot ?? 0,
    flpopMale: fl?.male ?? 0,
    flpopFemale: fl?.female ?? 0,
    topAges,
    flpopAsOf: SEOUL_ASOF.flpop,
  };

  const cats: SeoulCatDetail[] = [];
  for (const key of catKeys) {
    const def = CATEGORY_MAP[key];
    if (!def) continue;
    const ind = SEOUL_INDUSTY[key];
    if (!ind || !ind.code) {
      cats.push({
        category: key,
        label: def.label,
        hasSales: false,
        approx: false,
        basis: "카드매출 데이터 미제공 업종(서울시 62종 분류에 없음)",
      });
      continue;
    }
    const sale = salesOf(match.trdarCd, key);
    const store = storesOf(match.trdarCd, key);
    const stores = store?.stores ?? 0;
    const qAmt = sale?.amt ?? 0;
    const perStoreQ = stores > 0 ? Math.round(qAmt / stores) : 0;
    cats.push({
      category: key,
      label: def.label,
      hasSales: true,
      approx: ind.approx,
      basis: ind.basis,
      quarterSalesAmt: qAmt,
      monthlySalesAmt: Math.round(qAmt / 3),
      salesCnt: sale?.cnt ?? 0,
      stores,
      perStoreQuarterAmt: perStoreQ,
      perStoreMonthlyAmt: Math.round(perStoreQ / 3),
      franchise: store?.franchise ?? 0,
      openRate: store?.openRate ?? 0,
      salesAsOf: SEOUL_ASOF.sales,
      storesAsOf: SEOUL_ASOF.stores,
    });
  }
  return { trdar, categories: cats };
}
