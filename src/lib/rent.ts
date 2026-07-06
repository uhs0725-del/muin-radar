// 소규모상가 임대료(월세 가늠) — 전국 시도 단위. 서버/클라 공용.
// 데이터: 한국부동산원 상업용부동산 임대동향조사, 소규모상가 지역별 임대료(2026 Q1).
// 단위: ㎡당 월임대료(천원/㎡, 전용+공용). fetch: R-ONE stat page(fetch_rent 참고).

import rentRaw from "@/data/rent.json";

const RENT = rentRaw as unknown as Record<string, number | string>;

export const RENT_ASOF = (rentRaw as unknown as Record<string, string>)._asOf ?? "";
export const RENT_UNIT = (rentRaw as unknown as Record<string, string>)._unit ?? "천원/㎡";

// 카카오 region_1depth_name(예: "서울특별시","경기도","부산광역시") → rent.json 단축키.
const SI_ALIAS: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
  제주도: "제주",
};

export function normalizeSi(si: string): string | null {
  if (!si) return null;
  if (SI_ALIAS[si]) return SI_ALIAS[si];
  // 이미 단축형이면 그대로(전국 포함)
  if (RENT[si] !== undefined && typeof RENT[si] === "number") return si;
  // 접미사 제거 폴백(예상 밖 표기 대응)
  const trimmed = si.replace(/(특별자치시|특별자치도|특별시|광역시|자치도|도)$/u, "");
  if (RENT[trimmed] !== undefined && typeof RENT[trimmed] === "number") return trimmed;
  return null;
}

export interface RentInfo {
  region: string; // 정규화된 시도명(예: "경기")
  perM2ThousandWon: number; // ㎡당 월임대료(천원)
  nationwide: number; // 전국 평균(천원/㎡)
  asOf: string;
}

/** 카카오 시도명 → 소규모상가 임대료 시세. 매칭 실패 시 null(전국값은 nationwide로 항상 제공). */
export function rentForSi(si: string): RentInfo | null {
  const nat = typeof RENT["전국"] === "number" ? (RENT["전국"] as number) : 0;
  const key = normalizeSi(si);
  if (!key) return null;
  const v = RENT[key];
  if (typeof v !== "number") return null;
  return { region: key, perM2ThousandWon: v, nationwide: nat, asOf: RENT_ASOF };
}

// 평형(평) → ㎡ (1평 = 3.305785㎡)
export const PYEONG_M2 = 3.305785;

/** 평형별 월세 추정(원). perM2ThousandWon(천원/㎡) × 면적(㎡) × 1000. */
export function estimateMonthlyRent(perM2ThousandWon: number, pyeong: number): number {
  return Math.round(perM2ThousandWon * 1000 * pyeong * PYEONG_M2);
}
