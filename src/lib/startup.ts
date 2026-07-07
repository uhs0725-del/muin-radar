// 무인업종 초기 창업비용 시세 조회(만원). data/startup_costs.json 기반.
// 시뮬레이터 초기투자 프리필용 — "시세 기준, 수정 가능" 라벨과 함께.
import raw from "@/data/startup_costs.json";

export interface StartupCost {
  label: string;
  min: number; // 만원
  max: number;
  typical: number;
  note: string;
  sources: string[];
}

const COSTS = (raw as { costs: Record<string, StartupCost> }).costs;
export const STARTUP_ASOF = (raw as { _asOf?: string })._asOf ?? "";

/** 업종 키 → 창업비용 시세(만원). 없으면 null. */
export function startupCostFor(catKey: string): StartupCost | null {
  return COSTS[catKey] ?? null;
}
