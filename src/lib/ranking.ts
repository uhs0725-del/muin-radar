// 업종 추천 랭킹 — "이 자리엔 뭐가 좋나". 순수함수(LLM 없음).
// detailedReport가 측정가능 업종 전부를 primary 반경으로 스캔한 결과를 넘기면,
// 여유도(=100 - 전국 포화 백분위) 기준으로 정렬해 1~5위 랭킹 + 규칙 기반 근거를 만든다.

export interface RankingInput {
  category: string;
  label: string;
  measurable: true | "proxy" | false;
  count: number | null;
  // saturationScore 결과에서 뽑은 값(없을 수 있음)
  light: "green" | "yellow" | "red" | null;
  nationalTopPct?: number; // 전국 동 대비 상위 X% 포화(낮을수록 여유)
  // 참고 병기용(있을 때만)
  perStoreMonthlyAmt?: number; // 상권 카드매출 기반 점포당 월 추정매출(원)
  nightPct?: number; // 심야 매출 비중 %(서울만)
}

export interface RankingRow {
  rank: number;
  category: string;
  label: string;
  light: "green" | "yellow" | "red";
  // 여유도 0~100 = nationalTopPct 그 자체.
  // nationalTopPct="전국 상위 X% 포화": 낮을수록 포화(여유 없음), 높을수록 여유.
  // (엔진: topPct = 100 - 포화백분위 → 포화도 높으면 topPct 낮음.)
  headroom: number;
  nationalTopPct: number;
  reason: string;
}

const LIGHT_KO: Record<string, string> = { green: "여유", yellow: "주의", red: "포화" };

// 원 → 만원 축약(근거 문구용)
function manwon(n: number): string {
  return `${Math.round(n / 10000).toLocaleString()}만원`;
}

/**
 * 랭킹 산출. 측정 불가/무점수 업종은 랭킹에서 제외.
 * 정렬: 여유도 내림차순(=포화 낮은 순) → 동률이면 매장수 적은 순.
 */
export function rankCategories(inputs: RankingInput[]): RankingRow[] {
  const scored = inputs.filter(
    (i) =>
      i.measurable !== false &&
      i.count !== null &&
      i.light !== null &&
      i.nationalTopPct !== undefined,
  );

  // 여유도 = nationalTopPct(높을수록 여유). 내림차순 정렬 → 여유 있는 업종이 1위.
  const sorted = [...scored].sort((a, b) => {
    const ha = a.nationalTopPct ?? 0;
    const hb = b.nationalTopPct ?? 0;
    if (hb !== ha) return hb - ha;
    return (a.count ?? 0) - (b.count ?? 0);
  });

  return sorted.map((i, idx) => {
    const topPct = i.nationalTopPct ?? 0;
    const headroom = Math.round(topPct * 10) / 10;
    const light = (i.light ?? "yellow") as "green" | "yellow" | "red";
    return {
      rank: idx + 1,
      category: i.category,
      label: i.label,
      light,
      headroom,
      nationalTopPct: topPct,
      reason: buildReason(i, light, topPct),
    };
  });
}

function buildReason(
  i: RankingInput,
  light: "green" | "yellow" | "red",
  topPct: number,
): string {
  const cnt = i.count ?? 0;
  const parts: string[] = [];
  if (light === "green") {
    parts.push(`반경 내 ${cnt.toLocaleString()}곳으로 전국 상위 ${topPct}% — 경쟁 여유(초록)`);
  } else if (light === "yellow") {
    parts.push(`반경 내 ${cnt.toLocaleString()}곳으로 전국 상위 ${topPct}% — 경쟁 형성(주의)`);
  } else {
    parts.push(`반경 내 ${cnt.toLocaleString()}곳으로 전국 상위 ${topPct}% — 이미 포화(빨강)`);
  }
  if (i.perStoreMonthlyAmt && i.perStoreMonthlyAmt > 0) {
    parts.push(`점포당 월 추정매출 ${manwon(i.perStoreMonthlyAmt)}`);
  }
  if (i.nightPct !== undefined && i.nightPct >= 30) {
    parts.push(`심야 매출 ${i.nightPct}%로 무인 심야 이점 큼`);
  }
  return parts.join(" · ");
}

export { LIGHT_KO as RANK_LIGHT_KO };
