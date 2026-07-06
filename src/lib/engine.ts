// 포화도 진단 엔진 (서버 전용). Python engine.py 검증 로직을 TS로 포팅.
// 검증된 사실: 카카오 로컬 API는 리뷰/평점 미제공 → 점수는 매장 밀도 기반.
//             카카오 coord2regioncode 코드 == MOIS 행정동 코드(인구표 키).

import { CATEGORY_MAP, type CategoryDef, type Measurable } from "./categories";
import populationRaw from "@/data/population.json";
import calibrationRaw from "@/data/calibration.json";

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
  metric: "national_percentile" | "density_only";
  light: "green" | "yellow" | "red";
  verdict: string;
  storesPer10kPop?: number;
  nationalTopPct?: number;
  densityPerKm2: number;
  calibration: string;
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
): ScoreResult {
  const areaKm2 = Math.PI * (radiusM / 1000) ** 2;
  const density = areaKm2 ? count / areaKm2 : 0;
  const calib = calibForRadius(radiusM);
  const cinfo = catKey && calib ? calib[catKey] : undefined;

  if (pop && pop > 0 && cinfo) {
    const per10k = (count / pop) * 10000;
    const bp = cinfo.breakpoints;
    const pctile = Math.round(percentileOf(per10k, bp) * 10) / 10;
    const yellowAt = bp["60"] ?? 0;
    const redAt = bp["80"] ?? 0;
    let light: "green" | "yellow" | "red";
    if (per10k >= redAt && redAt > 0) light = "red";
    else if (per10k >= yellowAt && yellowAt > 0) light = "yellow";
    else light = "green";
    return {
      score: pctile,
      metric: "national_percentile",
      light,
      verdict: VERDICT[light],
      storesPer10kPop: Math.round(per10k * 10) / 10,
      nationalTopPct: Math.round((100 - pctile) * 10) / 10,
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

  const results: CategoryResult[] = [];
  for (const key of catKeys) {
    const def = CATEGORY_MAP[key];
    if (!def) continue;
    const comp = await collectCompetitors(def, geo.x, geo.y, radius, withStores);
    if (comp.count !== null) {
      comp.score = saturationScore(comp.count, radius, popinfo ? popinfo.pop : null, key);
    }
    results.push(comp);
  }

  const mode = popinfo
    ? `인구 정규화 ON · 중심 행정동 ${region?.dong} 인구 ${popinfo.pop.toLocaleString()}명 / ${popinfo.sede.toLocaleString()}세대`
    : "density-only · 행정동 인구 미매칭";

  return {
    ok: true,
    addressInput: address,
    addressNorm: geo.norm,
    region,
    population: popinfo,
    radiusM: radius,
    mode,
    results,
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

  const categories: CategoryReport[] = [];
  for (const key of catKeys) {
    const def = CATEGORY_MAP[key];
    if (!def) continue;

    // 선택 반경 기준 상세(매장 전체 리스트 포함)
    const primary = await collectCompetitors(def, geo.x, geo.y, radius, true);
    if (primary.count !== null) {
      primary.score = saturationScore(primary.count, radius, pop, key);
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
        comp.count !== null ? saturationScore(comp.count, r, pop, key) : undefined;
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

  const mode = popinfo
    ? `인구 정규화 ON · 중심 행정동 ${region?.dong} 인구 ${popinfo.pop.toLocaleString()}명 / ${popinfo.sede.toLocaleString()}세대`
    : "density-only · 행정동 인구 미매칭";

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
  };
}
