// 행정동 단위 카드매출 공통 레이어(서버 전용) — 서울·경기 공통.
// 목적: 서울(점포당)·경기(상권총액)로 기준이 달라 후보지 매출 비교가 불가했던 문제 해결.
//   → "행정동 업종 월 카드매출 총액" + "인구 1만명당 매출"을 **동일 기준**으로 제공.
//
// 데이터: src/data/dong_sales.json (fetch_dong_sales.py 생성)
//   - 서울 VwsmAdstrdSelngW(서울 열린데이터광장 상권분석, 62종 SVC_INDUTY, 분기→월 ÷3), asOf=2026Q1
//   - 경기 TB25BPTCARDDONGM(경기데이터드림 카드매출_행정동_집계, 카드 중분류, 월), asOf=2023-12, code TO=행정동 전체 총액
//   금액 단위 = 원/월. per-10k는 population.json 중심 행정동 거주인구로 계산.
//
// ❗기준시점 차이: 서울 2026Q1 vs 경기 2023-12(경기 일회성 덤프 종료월). 서울↔경기 혼합 비교 시 각주 필요.
// ❗경기 업종 매핑은 카드 중분류 근사(규격서 PDF 미확보 → 자매 데이터셋 "카드 소비 데이터" 코드사전 + TB25 실측 금액 크기 일치로 검증). _total(TO)는 사전 불필요·정확.

import dongRaw from "@/data/dong_sales.json";
import { CATEGORY_MAP } from "./categories";

interface DongSalesFile {
  _asOf: { seoul_quarter: string; gg_month: string };
  seoul: Record<string, Record<string, number>>; // dong8 -> {_total, convenience?, laundry?, ramen?}
  gg: Record<string, Record<string, number>>; // dong10 -> {_total, convenience?, laundry?, studycafe?, ramen?}
}
const DONG = dongRaw as unknown as DongSalesFile;

// 우리 카테고리 → 행정동 매출 매핑 근거(정직 표기). 지역별로 다름.
// 서울: VwsmAdstrdSelngW 62종(상권과 동일 분류) 직접/근사.
// 경기: 카드 중분류(자매 "카드 소비 데이터" 사전).
const SEOUL_BASIS: Record<string, { approx: boolean; basis: string }> = {
  convenience: { approx: false, basis: "편의점(서울 62종 직접 매핑)" },
  laundry: { approx: true, basis: "세탁소 분류(무인 코인빨래방 외 일반 세탁소 포함)" },
  ramen: { approx: true, basis: "분식전문점 분류(무인라면 외 일반 분식 포함)" },
};
const GG_BASIS: Record<string, { approx: boolean; basis: string }> = {
  convenience: { approx: true, basis: "카드 '종합소매점' 중분류(편의점 외 슈퍼·일반 소매 포함)" },
  laundry: { approx: true, basis: "카드 '세탁/가사서비스' 중분류(무인 외 일반 세탁 포함)" },
  studycafe: { approx: true, basis: "카드 '독서실/고시원' 중분류(스터디카페 외 일반 독서실 포함)" },
  ramen: { approx: true, basis: "카드 '분식' 중분류(무인라면 외 일반 분식 포함)" },
};

export interface DongCatAmt {
  category: string;
  label: string;
  monthlyAmt: number; // 행정동 업종 월 카드매출 총액(원)
  per10kPop: number | null; // 인구 1만명당 월 카드매출(원)
  approx: boolean;
  basis: string;
}

export interface DongSales {
  region: "seoul" | "gg";
  dongName: string;
  regionCode: string; // MOIS 10자리
  pop: number | null;
  totalMonthlyAmt: number; // 행정동 전체 월 카드매출(원) — 서울·경기 공통 기준
  totalPer10kPop: number | null; // 전체 인구 1만명당(원)
  asOf: string; // 표시용 기준시점(정직)
  asOfKind: "seoul" | "gg";
  categories: DongCatAmt[]; // 선택 업종 중 매핑 존재분(없으면 빈 배열)
}

function per10k(amt: number, pop: number | null): number | null {
  return pop && pop > 0 ? Math.round((amt / pop) * 10000) : null;
}

function fmtSeoulQuarter(q: string): string {
  // "20261" → "2026년 1분기(월 환산)"
  if (q.length === 5) return `${q.slice(0, 4)}년 ${q.slice(4)}분기(월 환산)`;
  return q;
}
function fmtGgMonth(m: string): string {
  // "202312" → "2023년 12월"
  if (m.length === 6) return `${m.slice(0, 4)}년 ${Number(m.slice(4))}월`;
  return m;
}

/**
 * 진단 행정동(MOIS 10자리 코드) → 행정동 단위 카드매출.
 * 서울/경기만 데이터 존재. 그 외 지역이면 null(미제공 지역).
 */
export function buildDongSales(
  regionCode: string | undefined,
  dongName: string | undefined,
  pop: number | null,
  catKeys: string[],
): DongSales | null {
  if (!regionCode) return null;

  // 서울: 8자리(MOIS10[:8])로 조회. 경기: 10자리 그대로.
  const seoul8 = regionCode.slice(0, 8);
  const sRow = DONG.seoul[seoul8];
  const gRow = DONG.gg[regionCode];

  if (sRow && typeof sRow._total === "number") {
    return {
      region: "seoul",
      dongName: dongName ?? "",
      regionCode,
      pop,
      totalMonthlyAmt: sRow._total,
      totalPer10kPop: per10k(sRow._total, pop),
      asOf: fmtSeoulQuarter(DONG._asOf.seoul_quarter),
      asOfKind: "seoul",
      categories: pickCats(sRow, catKeys, SEOUL_BASIS, pop),
    };
  }
  if (gRow && typeof gRow._total === "number") {
    return {
      region: "gg",
      dongName: dongName ?? "",
      regionCode,
      pop,
      totalMonthlyAmt: gRow._total,
      totalPer10kPop: per10k(gRow._total, pop),
      asOf: fmtGgMonth(DONG._asOf.gg_month),
      asOfKind: "gg",
      categories: pickCats(gRow, catKeys, GG_BASIS, pop),
    };
  }
  return null;
}

function pickCats(
  row: Record<string, number>,
  catKeys: string[],
  basisMap: Record<string, { approx: boolean; basis: string }>,
  pop: number | null,
): DongCatAmt[] {
  const out: DongCatAmt[] = [];
  for (const key of catKeys) {
    const b = basisMap[key];
    const amt = row[key];
    if (!b || typeof amt !== "number") continue; // 매핑 없거나 이 동에 데이터 없음
    const def = CATEGORY_MAP[key];
    out.push({
      category: key,
      label: def?.label ?? key,
      monthlyAmt: amt,
      per10kPop: per10k(amt, pop),
      approx: b.approx,
      basis: b.basis,
    });
  }
  return out;
}

export const DONG_ASOF = DONG._asOf;
