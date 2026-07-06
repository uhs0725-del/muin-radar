// 경기 상권 카드매출(v3) — 서버 전용.
// 진단 좌표 → 최근접 경기 상권(하버사인) 매칭 + 상권×업종 카드매출 조회.
// 경기 밖이면 전부 null → 기존 동작 그대로(회귀 금지).
//
// 데이터 출처: 경기도시장상권진흥원(카드사 결제 데이터 기반 추정치), 경기데이터드림 OpenAPI
// TBGGESTDEVALLSTM. fetch_gyeonggi.py 캐시.
// ❗탐색 확정(2026-07-07 전체 239,125행 스캔):
//   - 분기 2025 Q3 단일(시계열 없음), ADMDONG_CD·STORE_CNT 전부 null.
//   - 상권 위치 = 상권명 카카오 geocode(경기 prefix, 표본 100% 경기 내).
//   - 점포수 없음 → 점포당 매출은 카카오 반경 count로 나눔(분모 차이 명시).

import trdarRaw from "@/data/gg_trdar.json";
import salesRaw from "@/data/gg_sales.json";

interface GgTrdarEntry {
  name: string;
  lng: number;
  lat: number;
}
interface GgSalesEntry {
  amt: number; // 분기 카드매출 추정(원)
  cnt: number; // 분기 결제 건수
}

const GG_TRDAR = trdarRaw as unknown as Record<string, GgTrdarEntry | string>;
const GG_SALES = salesRaw as unknown as Record<string, Record<string, GgSalesEntry> | string>;

export const GG_ASOF = {
  sales: (salesRaw as unknown as Record<string, string>)._asOf ?? "",
};

// 무인업종 → 경기 KSIC 10차 업종코드 매핑(확정, 탐색 근거).
// direct=정확, approx=근사(라벨에 근사 기준 명시), code=""=경기 매출 데이터 없음.
export interface GgIndusty {
  code: string;
  approx: boolean;
  basis: string;
}
export const GG_INDUSTY: Record<string, GgIndusty> = {
  convenience: { code: "47122", approx: false, basis: "체인화 편의점(KSIC 직접 매핑)" },
  laundry: {
    code: "96912",
    approx: true,
    basis: "가정용 세탁업 분류 기준(무인 코인빨래방 외 일반 세탁소 포함)",
  },
  studycafe: {
    code: "90212",
    approx: true,
    basis: "독서실 운영업 분류 기준(스터디카페 외 일반 독서실 포함, 무인 구분 불가)",
  },
  photobooth: {
    code: "73301",
    approx: true,
    basis: "인물사진·행사영상 촬영업 분류 기준(무인 즉석사진 외 일반 사진관 포함)",
  },
  icecream: { code: "", approx: false, basis: "" }, // 경기 KSIC에 무인아이스크림 전용코드 없음
  ramen: {
    code: "56191",
    approx: true,
    basis: "김밥·간이 음식점업 분류 기준(무인라면 외 일반 분식 포함)",
  },
};

function asTrdar(v: GgTrdarEntry | string | undefined): GgTrdarEntry | null {
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

export interface GgMatch {
  trdarCd: string;
  name: string;
  distanceM: number;
  lng: number;
  lat: number;
}

// 경기 대략 경계: 위도 36.9~38.3, 경도 126.3~127.6. 밖이면 경기 아님.
function inGyeonggiBox(lng: number, lat: number): boolean {
  return lat >= 36.9 && lat <= 38.3 && lng >= 126.3 && lng <= 127.6;
}

/** 진단 좌표(WGS84 문자열) → 최근접 경기 상권. 경기 밖/너무 멀면 null. */
export function nearestGgTrdar(x: string, y: string): GgMatch | null {
  const lng = Number(x);
  const lat = Number(y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (!inGyeonggiBox(lng, lat)) return null;

  let best: GgMatch | null = null;
  for (const [cd, raw] of Object.entries(GG_TRDAR)) {
    const t = asTrdar(raw);
    if (!t) continue;
    const d = haversineM(lat, lng, t.lat, t.lng);
    if (!best || d < best.distanceM) {
      best = { trdarCd: cd, name: t.name, distanceM: Math.round(d), lng: t.lng, lat: t.lat };
    }
  }
  // 상권명 geocode라 좌표 정밀도가 낮아 서울(3km)보다 넉넉히 5km 허용.
  if (best && best.distanceM > 5000) return null;
  return best;
}

export function ggSalesOf(trdarCd: string, catKey: string): GgSalesEntry | null {
  const ind = GG_INDUSTY[catKey];
  if (!ind || !ind.code) return null;
  const row = GG_SALES[trdarCd];
  if (!row || typeof row === "string") return null;
  return row[ind.code] ?? null;
}
