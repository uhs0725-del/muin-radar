"use client";

// 상세 리포트 렌더 — 실물(/report)과 예시(/report/sample)가 동일 컴포넌트를 공유.
import { coupangItemsFor, coupangSearchLink, COUPANG_DISCLOSURE } from "@/lib/coupang";

export interface Store {
  id: string;
  name: string;
  distanceM: number | null;
}
export interface ScoreResult {
  score: number;
  light: "green" | "yellow" | "red";
  verdict: string;
  storesPer10kPop?: number;
  nationalTopPct?: number;
}
export interface CategoryResult {
  category: string;
  label: string;
  measurable: true | "proxy" | false;
  note?: string;
  count: number | null;
  sample: string[];
  stores?: Store[];
  score?: ScoreResult;
}
export interface RadiusRow {
  radiusM: number;
  count: number | null;
  storesPer10kPop?: number;
  nationalTopPct?: number;
  light: "green" | "yellow" | "red" | null;
}
export interface CategoryReport {
  category: string;
  label: string;
  measurable: true | "proxy" | false;
  note?: string;
  primary: CategoryResult;
  byRadius: RadiusRow[];
}
export interface ReportData {
  ok: boolean;
  error?: string;
  addressInput: string;
  addressNorm?: string;
  region?: { si: string; gu: string; dong: string } | null;
  population?: { pop: number; sede: number } | null;
  radiusM: number;
  mode: string;
  generatedAt: string;
  categories: CategoryReport[];
  summary?: string;
  conclusions?: { category: string; text: string }[];
  sampleAsOf?: string;
}

const LIGHT_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};
const LIGHT_TEXT: Record<string, string> = {
  green: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-red-600",
};
const LIGHT_KO: Record<string, string> = { green: "여유", yellow: "주의", red: "포화" };

function rLabel(m: number) {
  return m >= 1000 ? `${m / 1000}km` : `${m}m`;
}

/**
 * @param data 리포트 데이터
 * @param categoryKeys 쿠팡 링크용 선택 업종 키(있을 때만 쿠팡 섹션 렌더)
 * @param showCoupang 예시 페이지에선 false(전환 집중)
 */
export default function ReportView({
  data,
  categoryKeys = [],
  showCoupang = true,
}: {
  data: ReportData;
  categoryKeys?: string[];
  showCoupang?: boolean;
}) {
  const coupang = showCoupang ? coupangItemsFor(categoryKeys) : [];
  const gen = new Date(data.generatedAt);

  return (
    <>
      {/* 표지 */}
      <header className="report-block border-b border-slate-200 pb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          무인레이더 상권 포화도 상세 리포트
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {data.addressNorm || data.addressInput}
        </h1>
        <div className="mt-1 text-sm text-slate-600">
          {data.region && (
            <>
              {data.region.si} {data.region.gu} {data.region.dong} · 기준 반경{" "}
              {rLabel(data.radiusM)}
            </>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Info label="행정동" value={data.region?.dong ?? "-"} />
          <Info
            label="거주인구"
            value={data.population ? `${data.population.pop.toLocaleString()}명` : "미매칭"}
          />
          <Info
            label="세대수"
            value={data.population ? `${data.population.sede.toLocaleString()}세대` : "-"}
          />
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {data.sampleAsOf ? `${data.sampleAsOf} 기준 예시` : `생성 ${gen.toLocaleString("ko-KR")}`}{" "}
          · {data.mode}
        </div>
      </header>

      {/* 종합 결론 */}
      {data.summary && (
        <section className="report-block mt-5 rounded-2xl bg-slate-100 p-4 print:border print:border-slate-300 print:bg-white">
          <h2 className="text-sm font-bold text-slate-700">종합 결론</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{data.summary}</p>
        </section>
      )}

      {/* 업종별 상세 */}
      {data.categories.map((c) => {
        const conc = data.conclusions?.find((x) => x.category === c.category)?.text;
        return (
          <section key={c.category} className="report-block mt-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{c.label}</h2>
              {c.measurable === "proxy" && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  전체 업종 대체
                </span>
              )}
              {c.primary.score && (
                <span
                  className={`flex items-center gap-1 text-sm font-semibold ${LIGHT_TEXT[c.primary.score.light]}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_DOT[c.primary.score.light]}`} />
                  {LIGHT_KO[c.primary.score.light]}
                </span>
              )}
            </div>

            {c.measurable === false ? (
              <p className="mt-1 text-sm text-slate-400">{c.note || "측정 불가 (준비중)"}</p>
            ) : (
              <>
                {conc && <p className="mt-2 text-sm leading-relaxed text-slate-700">{conc}</p>}

                {/* 4개 반경 비교 테이블 */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                        <th className="py-1.5 pr-2 font-medium">반경</th>
                        <th className="py-1.5 pr-2 font-medium">매장수</th>
                        <th className="py-1.5 pr-2 font-medium">만명당</th>
                        <th className="py-1.5 pr-2 font-medium">전국 상위</th>
                        <th className="py-1.5 font-medium">신호등</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.byRadius.map((row) => (
                        <tr
                          key={row.radiusM}
                          className={`border-b border-slate-100 ${row.radiusM === data.radiusM ? "font-semibold" : ""}`}
                        >
                          <td className="py-1.5 pr-2">
                            {rLabel(row.radiusM)}
                            {row.radiusM === data.radiusM && (
                              <span className="ml-1 text-xs text-slate-400">(선택)</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2">
                            {row.count === null ? "-" : row.count.toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-2">{row.storesPer10kPop ?? "-"}</td>
                          <td className="py-1.5 pr-2">
                            {row.nationalTopPct !== undefined ? `${row.nationalTopPct}%` : "-"}
                          </td>
                          <td className="py-1.5">
                            {row.light ? (
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${LIGHT_DOT[row.light]}`}
                                />
                                <span className={LIGHT_TEXT[row.light]}>{LIGHT_KO[row.light]}</span>
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 경쟁 매장 전체 리스트 */}
                {c.primary.stores && c.primary.stores.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-slate-500">
                      반경 {rLabel(data.radiusM)} 경쟁 매장 {c.primary.stores.length}곳
                      {c.primary.count !== null &&
                        c.primary.count > c.primary.stores.length &&
                        ` (전체 ${c.primary.count.toLocaleString()}곳 중 상위 ${c.primary.stores.length}곳 표시)`}
                    </div>
                    <ol className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm text-slate-700 sm:grid-cols-2">
                      {c.primary.stores.map((s, i) => (
                        <li
                          key={s.id}
                          className="flex justify-between border-b border-slate-50 py-0.5"
                        >
                          <span className="truncate pr-2">
                            {i + 1}. {s.name}
                          </span>
                          <span className="shrink-0 text-slate-400">
                            {s.distanceM !== null ? `${s.distanceM}m` : "-"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      {/* 쿠팡 파트너스 맥락 링크 — 인쇄 시 숨김, 예시 페이지엔 미노출 */}
      {coupang.length > 0 && (
        <section className="no-print mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-700">업종별 추천 상품 (쿠팡)</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {coupang.map(({ item }, i) => (
              <a
                key={i}
                href={coupangSearchLink(item.query)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-slate-400"
              >
                {item.label} →
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{COUPANG_DISCLOSURE}</p>
        </section>
      )}

      {/* 면책 */}
      <footer className="report-block mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400">
        <p className="font-semibold text-slate-500">데이터 출처 · 한계</p>
        <p className="mt-1">
          매장 수: 카카오 로컬 검색(반경 기준). 인구·세대: 행정안전부 주민등록 인구통계(월간).
          포화도는 매장 수를 <b>중심 행정동 거주인구</b>로 환산한 근사치이며, 반경이 여러 동에
          걸치거나 상업·오피스 지역(유동·직장 인구 다수)에서는 실제 대비 과대/과소평가될 수
          있습니다. 전국 행정동 표본 분포 대비 백분위로 신호등을 산출했습니다.
        </p>
        <p className="mt-1">
          카카오 데이터에 &lsquo;무인&rsquo; 구분이 없는 업종(예: 편의점)은 전체 업종 밀도로 대체
          표시(proxy)하며, 데이터가 부족한 업종은 진단을 보류합니다. 본 리포트는 참고용 정보이며
          투자·창업 결정의 책임은 이용자에게 있습니다.
        </p>
      </footer>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 print:border print:border-slate-200 print:bg-white">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}
