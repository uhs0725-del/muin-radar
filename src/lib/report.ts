// 규칙 기반 종합 결론 생성기 — LLM 호출 없음(비용 0). 진단 수치에서 결정론적으로 문단 생성.
import type { CategoryReport, DetailedReport } from "./engine";

const LIGHT_KO: Record<string, string> = {
  green: "여유(초록)",
  yellow: "주의(노랑)",
  red: "포화(빨강)",
};

// 업종 1개에 대한 결론 문단(선택 반경 기준 + 반경 추세).
export function conclusionForCategory(cr: CategoryReport, radiusM: number): string {
  if (cr.measurable === false) {
    return `${cr.label}: 카카오 로컬 데이터로는 신뢰할 수 있는 매장 수를 얻을 수 없어 진단을 보류합니다. ${cr.note ?? ""}`.trim();
  }
  const s = cr.primary.score;
  const cnt = cr.primary.count;
  if (cnt === null || !s) {
    return `${cr.label}: 이 지역에서 측정 가능한 매장이 없어 결론을 내리기 어렵습니다.`;
  }
  const rLabel = radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`;
  const lightKo = LIGHT_KO[s.light] ?? s.light;

  let head: string;
  if (s.light === "red") {
    head = `${cr.label}은(는) 반경 ${rLabel} 안에 ${cnt.toLocaleString()}곳이 밀집해 있어 전국 행정동 대비 상위 ${s.nationalTopPct}% 수준의 ${lightKo} 상권입니다. 신규 진입 시 기존 매장과의 직접 경쟁이 불가피하므로, 확실한 입지·가격·서비스 차별화 없이는 진입을 권하지 않습니다.`;
  } else if (s.light === "yellow") {
    head = `${cr.label}은(는) 반경 ${rLabel} 안에 ${cnt.toLocaleString()}곳으로 전국 상위 ${s.nationalTopPct}% 수준의 ${lightKo} 상권입니다. 이미 경쟁이 형성되어 있어, 차별화 포인트(운영 시간·회원 관리·부가 서비스 등)를 확보한다는 전제에서만 검토할 만합니다.`;
  } else {
    head = `${cr.label}은(는) 반경 ${rLabel} 안에 ${cnt.toLocaleString()}곳으로 전국 상위 ${s.nationalTopPct}% 수준의 ${lightKo} 상권입니다. 경쟁 밀도가 낮아 신규 진입을 검토할 여지가 있으나, 매장 수가 적은 것이 수요 부족 때문일 수 있으니 배후 수요를 별도로 확인하세요.`;
  }

  // 반경 추세: 신호등이 반경별로 어떻게 바뀌는지 한 줄.
  const lights = cr.byRadius.filter((b) => b.light).map((b) => b.light);
  let trend = "";
  if (lights.length >= 2) {
    const reds = cr.byRadius.filter((b) => b.light === "red").map((b) => b.radiusM);
    if (reds.length) {
      const rr = reds.map((r) => (r >= 1000 ? `${r / 1000}km` : `${r}m`)).join("·");
      trend = ` 반경별로 보면 ${rr} 구간에서 포화(빨강)로 나타나, 상권을 넓게 볼수록 경쟁이 짙어집니다.`;
    }
  }
  return head + trend;
}

// 전체 요약 한 줄 — 선택 업종 중 가장 포화된 상태 기준.
export function overallSummary(report: DetailedReport): string {
  const measurable = report.categories.filter(
    (c) => c.measurable !== false && c.primary.count !== null && c.primary.score,
  );
  if (!measurable.length) {
    return "선택하신 업종은 이 지역에서 측정 가능한 데이터가 부족해 종합 결론을 제시하기 어렵습니다.";
  }
  const rank = { green: 0, yellow: 1, red: 2 };
  const worst = measurable.reduce((a, b) =>
    rank[b.primary.score!.light] > rank[a.primary.score!.light] ? b : a,
  );
  const reds = measurable.filter((c) => c.primary.score!.light === "red").map((c) => c.label);
  const greens = measurable.filter((c) => c.primary.score!.light === "green").map((c) => c.label);

  const parts: string[] = [];
  const dong = report.region?.dong ?? report.addressNorm ?? "이 지역";
  if (reds.length) {
    parts.push(`${dong} 기준으로 ${reds.join(", ")}은(는) 포화 상태(빨강)로, 신규 진입 위험이 높습니다.`);
  }
  if (greens.length) {
    parts.push(`${greens.join(", ")}은(는) 상대적으로 여유(초록)가 있어 검토 여지가 있습니다.`);
  }
  if (!parts.length) {
    parts.push(`${dong}의 선택 업종은 대체로 주의(노랑) 구간으로, 차별화 전략을 전제로 검토할 만합니다.`);
  }
  return parts.join(" ") + ` 가장 주의가 필요한 업종은 ${worst.label}입니다.`;
}
