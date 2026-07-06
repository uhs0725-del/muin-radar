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

const KEY = process.env.KAKAO_REST_KEY || "";
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

// 키워드 검색 → category_name 필터로 매장 수집(중복제거). 카카오 페이지 상한 45.
async function collectFiltered(
  query: string | null,
  categoryCode: string | null,
  x: string,
  y: string,
  radius: number,
  keepCategory: string[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (let page = 1; page <= 3; page++) {
    const d = await searchPage(query, categoryCode, x, y, radius, page);
    for (const doc of d.documents || []) {
      const cn: string = doc.category_name || "";
      if (keepCategory.length && !keepCategory.some((k) => cn.includes(k))) continue;
      ids.set(doc.id, doc.place_name || "");
    }
    if (d.meta?.is_end ?? true) break;
  }
  return ids;
}

export interface CategoryResult {
  category: string;
  label: string;
  measurable: Measurable;
  note?: string;
  count: number | null;
  sample: string[];
  score?: ScoreResult;
}

export async function collectCompetitors(
  def: CategoryDef,
  x: string,
  y: string,
  radius: number,
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
  const merged = new Map<string, string>();
  let catTotal: number | null = null;

  if (def.categoryCode) {
    // 편의점(CS2): 카테고리코드=필터(오탐 없음) → total_count가 정확(45 초과 포함).
    const d = await searchPage(null, def.categoryCode, x, y, radius, 1);
    catTotal = d.meta?.total_count ?? 0;
    for (const doc of d.documents || []) merged.set(doc.id, doc.place_name || "");
  }
  for (const kw of def.keywords) {
    const ids = await collectFiltered(kw, null, x, y, radius, def.keepCategory);
    ids.forEach((v, k) => merged.set(k, v));
  }

  const count = catTotal !== null ? catTotal : merged.size;

  return {
    category: def.key,
    label: def.label,
    measurable: def.measurable,
    note: def.note,
    count,
    sample: Array.from(merged.values()).slice(0, 6),
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
    const comp = await collectCompetitors(def, geo.x, geo.y, radius);
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
