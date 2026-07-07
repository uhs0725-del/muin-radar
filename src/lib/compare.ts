// 후보지 비교 — 여러 주소의 detailedReport 결과를 비교 테이블 데이터 + 규칙 판정으로 축약.
// 순수 로직(LLM 없음). 응답 크기 축소를 위해 stores 리스트는 포함하지 않는다.
import type { DetailedReport } from "./engine";

export interface CompareCatMetric {
  category: string;
  label: string;
  measurable: true | "proxy" | false;
  count: number | null;
  light: "green" | "yellow" | "red" | null;
  nationalTopPct?: number; // 전국 상위 % (낮을수록 여유)
  residTopPct?: number; // 서울 거주 대비 상위 %
  flpopTopPct?: number; // 서울 유동 대비 상위 %
  perStoreMonthlyAmt?: number; // 상권 카드매출 점포당 월 추정매출(원) — 서울만(경기는 점포수 미제공)
  monthlySalesAmt?: number; // 상권 업종 월 카드매출 총액(원) — 경기 표시용
  perTxnAmt?: number; // 건당 결제단가(원/건) — 경기 표시용
  nightPct?: number; // 심야 매출 비중 %(서울)
}

export interface CompareSite {
  address: string;
  addressNorm?: string;
  region?: { si: string; gu: string; dong: string } | null;
  population?: { pop: number; sede: number } | null;
  inSeoul: boolean;
  inGyeonggi: boolean;
  trdarName?: string; // 서울/경기 최근접 상권
  flpopTot?: number; // 서울 유동인구
  rentPerM2?: number; // 소규모상가 ㎡당 월임대료(천원)
  cats: CompareCatMetric[];
  // 종합 점수용 — 측정업종 평균 여유도(높을수록 여유). 판정 근거.
  avgHeadroom: number | null;
  worstLight: "green" | "yellow" | "red" | null;
}

export interface CompareResult {
  radiusM: number;
  categories: { key: string; label: string }[]; // 비교 대상 업종(공통)
  sites: CompareSite[];
  verdict: string; // 규칙 기반 종합 판정
  bestIndex: number | null; // sites 중 1순위(여유도 최대)
}

const RANK = { green: 0, yellow: 1, red: 2 } as const;

// detailedReport 1건 → CompareSite로 축약.
export function toCompareSite(rep: DetailedReport): CompareSite {
  const inSeoul = !!rep.seoul;
  const inGyeonggi = !inSeoul && !!rep.gyeonggi;

  const cats: CompareCatMetric[] = rep.categories.map((c) => {
    const s = c.primary.score;
    const sCat = rep.seoul?.categories.find((x) => x.category === c.category);
    const gCat = rep.gyeonggi?.categories.find((x) => x.category === c.category);
    return {
      category: c.category,
      label: c.label,
      measurable: c.measurable,
      count: c.primary.count,
      light: s?.light ?? null,
      nationalTopPct: s?.nationalTopPct,
      residTopPct: s?.seoul?.residTopPct,
      flpopTopPct: s?.seoul?.flpopTopPct,
      // 점포당 월매출은 서울만(경기는 상권 내 점포수 미제공 → 산출 불가).
      perStoreMonthlyAmt: sCat?.perStoreMonthlyAmt,
      // 경기는 상권 월 카드매출 총액 + 건당 결제단가로 표시.
      monthlySalesAmt: gCat?.monthlySalesAmt,
      perTxnAmt: gCat?.perTxnAmt,
      nightPct: sCat?.nightPct,
    };
  });

  const measurable = cats.filter(
    (c) => c.measurable !== false && c.count !== null && c.nationalTopPct !== undefined,
  );
  // 여유도 = nationalTopPct(높을수록 여유 — 엔진에서 topPct=100-포화백분위).
  const avgHeadroom = measurable.length
    ? Math.round(
        (measurable.reduce((a, c) => a + (c.nationalTopPct ?? 0), 0) / measurable.length) * 10,
      ) / 10
    : null;
  let worstLight: "green" | "yellow" | "red" | null = null;
  for (const c of measurable) {
    if (!c.light) continue;
    if (!worstLight || RANK[c.light] > RANK[worstLight]) worstLight = c.light;
  }

  return {
    address: rep.addressInput,
    addressNorm: rep.addressNorm,
    region: rep.region
      ? { si: rep.region.si, gu: rep.region.gu, dong: rep.region.dong }
      : null,
    population: rep.population,
    inSeoul,
    inGyeonggi,
    trdarName: rep.seoul?.trdar.trdarName ?? rep.gyeonggi?.trdar.trdarName,
    flpopTot: rep.seoul?.trdar.flpopTot,
    rentPerM2: rep.rent?.perM2ThousandWon,
    cats,
    avgHeadroom,
    worstLight,
  };
}

// 여러 사이트 → 규칙 기반 종합 판정.
export function buildCompareResult(
  sites: CompareSite[],
  radiusM: number,
  categories: { key: string; label: string }[],
): CompareResult {
  // 1순위 = 평균 여유도 최대(측정 데이터 있는 곳만). 동률이면 worstLight가 덜 나쁜 쪽.
  let bestIndex: number | null = null;
  let best: CompareSite | null = null;
  sites.forEach((s, i) => {
    if (s.avgHeadroom === null) return;
    if (
      best === null ||
      s.avgHeadroom > (best.avgHeadroom ?? -1) ||
      (s.avgHeadroom === best.avgHeadroom &&
        (RANK[s.worstLight ?? "red"] < RANK[best.worstLight ?? "red"]))
    ) {
      best = s;
      bestIndex = i;
    }
  });

  const verdict = buildVerdict(sites, bestIndex, categories);
  return { radiusM, categories, sites, verdict, bestIndex };
}

function siteName(s: CompareSite): string {
  return s.region?.dong || s.addressNorm || s.address;
}

function buildVerdict(
  sites: CompareSite[],
  bestIndex: number | null,
  categories: { key: string; label: string }[],
): string {
  if (bestIndex === null) {
    return "선택한 후보지에서 측정 가능한 데이터가 부족해 우열을 가리기 어렵습니다. 업종·반경을 바꿔 다시 시도해 보세요.";
  }
  const best = sites[bestIndex];
  const parts: string[] = [];
  parts.push(
    `${siteName(best)}이(가) 선택 업종의 평균 여유도(포화도 낮음)에서 가장 앞서 1순위로 권장됩니다(평균 여유도 ${best.avgHeadroom}).`,
  );

  // 업종별로 가장 여유 있는 후보 짚기
  for (const cat of categories) {
    const withData = sites
      .map((s, i) => ({ i, m: s.cats.find((c) => c.category === cat.key) }))
      .filter((x) => x.m && x.m.count !== null && x.m.nationalTopPct !== undefined);
    if (withData.length < 2) continue;
    const bestForCat = withData.reduce((a, b) =>
      (b.m!.nationalTopPct ?? 0) > (a.m!.nationalTopPct ?? 0) ? b : a,
    );
    parts.push(
      `${cat.label}은(는) ${siteName(sites[bestForCat.i])}이(가) 상위 ${bestForCat.m!.nationalTopPct}%로 가장 여유 있습니다.`,
    );
  }

  // 심야(서울) 우위 짚기
  const seoulNight = sites
    .map((s, i) => ({ i, s }))
    .filter((x) => x.s.inSeoul)
    .map((x) => {
      const maxNight = Math.max(0, ...x.s.cats.map((c) => c.nightPct ?? 0));
      return { i: x.i, maxNight };
    })
    .filter((x) => x.maxNight > 0);
  if (seoulNight.length) {
    const bn = seoulNight.reduce((a, b) => (b.maxNight > a.maxNight ? b : a));
    if (bn.maxNight >= 25) {
      parts.push(
        `심야 수요는 ${siteName(sites[bn.i])}이(가) 가장 높아(최대 심야 매출 비중 ${bn.maxNight}%) 무인 24시간 운영에 유리합니다.`,
      );
    }
  }

  return parts.join(" ");
}
