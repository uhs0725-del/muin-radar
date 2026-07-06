// 서울 상권 프리미엄(v2) — 서버 전용.
// 진단 좌표 → 최근접 서울 상권(하버사인) 매칭 + 유동인구/카드매출/점포 캐시 조회.
// 서울 밖이면 전부 null 반환 → 기존(전국 거주인구) 동작 그대로(회귀 금지).
//
// 데이터 출처: 서울 열린데이터광장 상권분석서비스(서울신용보증재단). fetch_seoul.py 캐시.
// 좌표는 EPSG:5181(TM)을 카카오 transcoord로 WGS84 변환해 저장(검증: 강남역 상권 127.0285/37.5003).

import trdarRaw from "@/data/seoul_trdar.json";
import flpopRaw from "@/data/seoul_flpop.json";
import salesRaw from "@/data/seoul_sales.json";
import storesRaw from "@/data/seoul_stores.json";
import salesTrendRaw from "@/data/seoul_sales_trend.json";

interface TrdarEntry {
  name: string;
  lng: number;
  lat: number;
  adstrd: string;
  adstrdCd: string;
  area: number;
}
interface FlpopEntry {
  tot: number;
  male: number;
  female: number;
  age10: number;
  age20: number;
  age30: number;
  age40: number;
  age50: number;
  age60: number;
}
interface SalesEntry {
  amt: number;
  cnt: number;
}
interface StoreEntry {
  stores: number;
  franchise: number;
  openRate: number;
  closeRate?: number;
}
// 분기 시계열: {TRDAR_CD: {업종코드: {분기: 카드매출 만원}}}
type TrendTrdar = Record<string, Record<string, number>>;

const TRDAR = trdarRaw as unknown as Record<string, TrdarEntry | string>;
const FLPOP = flpopRaw as unknown as Record<string, FlpopEntry | string>;
const SALES = salesRaw as unknown as Record<string, Record<string, SalesEntry> | string>;
const STORES = storesRaw as unknown as Record<string, Record<string, StoreEntry> | string>;
const SALES_TREND = salesTrendRaw as unknown as Record<string, TrendTrdar | string | string[]>;
export const SEOUL_TREND_QUARTERS = ((salesTrendRaw as unknown as Record<string, string[]>)
  ._quarters ?? []) as string[];

export const SEOUL_ASOF = {
  flpop: (flpopRaw as unknown as Record<string, string>)._asOf ?? "",
  sales: (salesRaw as unknown as Record<string, string>)._asOf ?? "",
  stores: (storesRaw as unknown as Record<string, string>)._asOf ?? "",
  trend: (salesTrendRaw as unknown as Record<string, string>)._asOf ?? "",
};

// 무인업종 → 서울 62종 업종코드 매핑(확정). fetch_seoul.py와 동일.
// direct=정확 매핑, approx=근사(라벨에 근사 기준 명시), null=서울 매출 데이터 없음.
export interface SeoulIndusty {
  code: string;
  approx: boolean;
  basis: string; // 근사 기준 설명(정직 표기)
}
export const SEOUL_INDUSTY: Record<string, SeoulIndusty> = {
  convenience: { code: "CS300002", approx: false, basis: "편의점(직접 매핑)" },
  laundry: {
    code: "CS200031",
    approx: true,
    basis: "세탁소 분류 기준(무인 코인빨래방 외 일반 세탁소 포함)",
  },
  studycafe: { code: "", approx: false, basis: "" }, // 서울 매출 데이터 없음
  photobooth: { code: "", approx: false, basis: "" },
  icecream: { code: "", approx: false, basis: "" },
  ramen: {
    code: "CS100008",
    approx: true,
    basis: "분식전문점 분류 기준(무인라면 외 일반 분식 포함)",
  },
};

// 참고: 무인카페(cafe)는 현재 CATEGORIES에 별도 키가 없어 매핑만 예비(커피-음료 CS100010).
export const SEOUL_CAFE_CODE = "CS100010";

function asTrdar(v: TrdarEntry | string | undefined): TrdarEntry | null {
  return v && typeof v !== "string" ? v : null;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface SeoulMatch {
  trdarCd: string;
  name: string;
  distanceM: number;
  adstrd: string;
  lng: number;
  lat: number;
}

// 서울 경계(대략): 위도 37.42~37.70, 경도 126.76~127.19. 밖이면 서울 아님.
function inSeoulBox(lng: number, lat: number): boolean {
  return lat >= 37.41 && lat <= 37.72 && lng >= 126.75 && lng <= 127.2;
}

/** 진단 좌표(WGS84 문자열) → 최근접 서울 상권. 서울 밖이면 null. */
export function nearestTrdar(x: string, y: string): SeoulMatch | null {
  const lng = Number(x);
  const lat = Number(y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (!inSeoulBox(lng, lat)) return null;

  let best: SeoulMatch | null = null;
  for (const [cd, raw] of Object.entries(TRDAR)) {
    const t = asTrdar(raw);
    if (!t) continue;
    const d = haversineM(lat, lng, t.lat, t.lng);
    if (!best || d < best.distanceM) {
      best = {
        trdarCd: cd,
        name: t.name,
        distanceM: Math.round(d),
        adstrd: t.adstrd,
        lng: t.lng,
        lat: t.lat,
      };
    }
  }
  // 최근접이라도 너무 멀면(예: 3km 초과) 매칭 안 함 — 상권 밖 취급.
  if (best && best.distanceM > 3000) return null;
  return best;
}

/** 반경 내 서울 상권 목록(거리 오름차순). */
export function trdarsWithin(x: string, y: string, radiusM: number): SeoulMatch[] {
  const lng = Number(x);
  const lat = Number(y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
  if (!inSeoulBox(lng, lat)) return [];
  const out: SeoulMatch[] = [];
  for (const [cd, raw] of Object.entries(TRDAR)) {
    const t = asTrdar(raw);
    if (!t) continue;
    const d = haversineM(lat, lng, t.lat, t.lng);
    if (d <= radiusM) {
      out.push({
        trdarCd: cd,
        name: t.name,
        distanceM: Math.round(d),
        adstrd: t.adstrd,
        lng: t.lng,
        lat: t.lat,
      });
    }
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

export function flpopOf(trdarCd: string): FlpopEntry | null {
  const v = FLPOP[trdarCd];
  return v && typeof v !== "string" ? v : null;
}

export function salesOf(trdarCd: string, catKey: string): SalesEntry | null {
  const ind = SEOUL_INDUSTY[catKey];
  if (!ind || !ind.code) return null;
  const row = SALES[trdarCd];
  if (!row || typeof row === "string") return null;
  return row[ind.code] ?? null;
}

export function storesOf(trdarCd: string, catKey: string): StoreEntry | null {
  const ind = SEOUL_INDUSTY[catKey];
  if (!ind || !ind.code) return null;
  const row = STORES[trdarCd];
  if (!row || typeof row === "string") return null;
  return row[ind.code] ?? null;
}

/**
 * 분기 매출 시계열(최근 n분기). 반환: [{quarter, amt(만원)}] 오름차순.
 * 데이터 없으면 빈 배열.
 */
export function salesTrendOf(
  trdarCd: string,
  catKey: string,
  lastN = 8,
): { quarter: string; amt: number }[] {
  const ind = SEOUL_INDUSTY[catKey];
  if (!ind || !ind.code) return [];
  const row = SALES_TREND[trdarCd];
  if (!row || typeof row === "string" || Array.isArray(row)) return [];
  const series = row[ind.code];
  if (!series) return [];
  const quarters = SEOUL_TREND_QUARTERS.length
    ? SEOUL_TREND_QUARTERS
    : Object.keys(series).sort();
  const recent = quarters.slice(-lastN);
  return recent
    .filter((q) => series[q] !== undefined)
    .map((q) => ({ quarter: q, amt: series[q] }));
}
