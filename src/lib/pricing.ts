/**
 * 결제 정책 — 단일 상품(14일 이용권, 자동갱신 아님).
 * ₩19,900 결제 1건 = ① 상세 PDF 리포트 ② 14일 무제한 진단(엔타이틀먼트 쿠키로 쿼터 스킵).
 * 상품을 쪼개지 않는다.
 */

export type ProductId = "report";

export const PRICES = {
  report: 19900, // 상세 리포트 + 14일 무제한 진단
} as const;

export const ORDER_NAMES: Record<ProductId, string> = {
  report: "무인레이더 상세 리포트(PDF) + 14일 무제한 진단",
};

/**
 * 주문 ID에 상품/진단 파라미터를 인코딩.
 * 토스 orderId 규격 [A-Za-z0-9_-] 6~64자 유지 → 진단 컨텍스트는 별도 localStorage로 전달.
 */
export function makeOrderId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `mr_report_${t}_${r}`;
}

/** orderId에서 상품 파싱. 현재 상품 1종 → 항상 report. */
export function productFromOrderId(orderId: string): ProductId {
  return orderId.split("_")[1] === "report" ? "report" : "report";
}

const KEY = "mr_report_unlocked";

/** 결제 완료로 해제되었는지 (브라우저 보관 — UI 표시용, 실제 게이트는 서버 쿠키) */
export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** 결제 승인 성공 시 호출 */
export function setUnlocked(orderId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, "1");
    if (orderId) localStorage.setItem("mr_last_order", orderId);
  } catch {
    /* ignore */
  }
}
