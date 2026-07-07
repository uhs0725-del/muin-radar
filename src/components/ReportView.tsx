"use client";

// 상세 리포트 렌더 — 실물(/report)과 예시(/report/sample)가 동일 컴포넌트를 공유.
import { useState } from "react";
import { coupangItemsFor, coupangSearchLink, COUPANG_DISCLOSURE } from "@/lib/coupang";
import { estimateMonthlyRent } from "@/lib/rent";

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
  seoul?: {
    trdarName: string;
    flpopTot: number;
    storesPer10kFlpop: number;
    flpopTopPct: number;
    residTopPct: number;
  };
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
export interface SeoulTrdarInfo {
  trdarName: string;
  distanceM: number;
  adstrd: string;
  flpopTot: number;
  flpopMale: number;
  flpopFemale: number;
  topAges: { label: string; value: number }[];
  flpopAsOf: string;
}
export interface SeoulCatDetail {
  category: string;
  label: string;
  hasSales: boolean;
  approx: boolean;
  basis: string;
  quarterSalesAmt?: number;
  monthlySalesAmt?: number;
  salesCnt?: number;
  stores?: number;
  perStoreQuarterAmt?: number;
  perStoreMonthlyAmt?: number;
  franchise?: number;
  openRate?: number;
  closeRate?: number;
  salesAsOf?: string;
  storesAsOf?: string;
  trend?: { quarter: string; amt: number }[];
  yoyPct?: number | null;
  nightPct?: number;
  weekendPct?: number;
  nightVerdict?: string;
}
export interface SeoulPremium {
  trdar: SeoulTrdarInfo;
  categories: SeoulCatDetail[];
}
export interface GyeonggiTrdarInfo {
  trdarName: string;
  distanceM: number;
  salesAsOf: string;
}
export interface GyeonggiCatDetail {
  category: string;
  label: string;
  hasSales: boolean;
  approx: boolean;
  basis: string;
  quarterSalesAmt?: number;
  monthlySalesAmt?: number;
  salesCnt?: number;
  kakaoCount?: number;
  perStoreMonthlyAmt?: number;
}
export interface GyeonggiPremium {
  trdar: GyeonggiTrdarInfo;
  categories: GyeonggiCatDetail[];
}
export interface RentInfo {
  region: string;
  perM2ThousandWon: number;
  nationwide: number;
  asOf: string;
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
  seoul?: SeoulPremium | null;
  gyeonggi?: GyeonggiPremium | null;
  rent?: RentInfo | null;
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

                {/* 서울: 거주/유동 이중 백분위 병기 */}
                {c.primary.score?.seoul && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                      거주인구 대비 상위 {c.primary.score.seoul.residTopPct}%
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                      유동인구 대비 상위 {c.primary.score.seoul.flpopTopPct}%
                    </span>
                  </div>
                )}

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

      {/* 월세 가늠 (전국 공통) */}
      {data.rent && <RentSection rent={data.rent} regionSi={data.region?.si} />}

      {/* 상권 프리미엄: 서울(유동인구·점포 포함) 또는 경기(카드매출), 그 외 준비중 */}
      {data.seoul ? (
        <SeoulPremiumSection premium={data.seoul} rent={data.rent ?? null} />
      ) : data.gyeonggi ? (
        <GyeonggiPremiumSection premium={data.gyeonggi} rent={data.rent ?? null} />
      ) : (
        <section className="report-block rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-base font-bold text-slate-700">
            상권 카드매출 분석 — 현재 서울·경기 제공
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            상권별 카드매출 추정(점포당 월매출)과 예상수익 시뮬레이터는 공공 상권분석
            데이터 기반이라 현재 <b>서울·경기 주소 진단에서만</b> 제공됩니다(서울은 유동인구
            반영 점수 추가). 진단 위치가 서울·경기 외 지역이어서 이 섹션이 표시되지
            않았습니다. 그 외 지역은 해당 공공데이터가 공개되는 대로 확장할 예정입니다.
          </p>
        </section>
      )}

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

// 원 → 억/만원 축약 표기
function won(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만원`;
  return `${Math.round(n).toLocaleString()}원`;
}

// 분기 코드(20261) → 표기(26.1Q)
function qLabel(q: string): string {
  return `${q.slice(2, 4)}.${q.slice(4)}Q`;
}

// 분기 매출 추이 — 순수 SVG/CSS 막대 스파크라인(라이브러리 없음). 상권×업종 카드매출.
function SalesTrend({
  trend,
  yoyPct,
}: {
  trend: { quarter: string; amt: number }[];
  yoyPct: number | null;
}) {
  const max = Math.max(...trend.map((t) => t.amt), 1);
  const W = 100;
  const H = 36;
  const gap = 2;
  const bw = (W - gap * (trend.length - 1)) / trend.length;
  const last = trend[trend.length - 1];
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">분기 카드매출 추이</span>
        {yoyPct !== null && (
          <span
            className={`text-xs font-semibold ${yoyPct >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            전년동기 {yoyPct >= 0 ? "▲" : "▼"} {Math.abs(yoyPct)}%
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-end gap-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-10 w-40 shrink-0"
          preserveAspectRatio="none"
          role="img"
          aria-label="분기별 카드매출 막대 그래프"
        >
          {trend.map((t, i) => {
            const h = Math.max((t.amt / max) * H, 1);
            const isLast = i === trend.length - 1;
            return (
              <rect
                key={t.quarter}
                x={i * (bw + gap)}
                y={H - h}
                width={bw}
                height={h}
                rx={0.6}
                className={isLast ? "fill-indigo-600" : "fill-indigo-300"}
              />
            );
          })}
        </svg>
        <div className="text-[11px] leading-tight text-slate-400">
          {qLabel(trend[0].quarter)} → {qLabel(last.quarter)} · {trend.length}분기
          <br />
          최신 {won(last.amt * 10000)}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        분기 카드매출 추정 추이 — 상권 단위이며 점포수 변화 미반영.
      </p>
    </div>
  );
}

// ── 월세 가늠 섹션 (전국 공통) ─────────────────────────────────────
const PYEONGS = [10, 15, 20, 30];

function RentSection({ rent, regionSi }: { rent: RentInfo; regionSi?: string }) {
  // 시세로 채우기: 20평 기준 월세를 시뮬레이터에 반영하려면 이벤트로 전달(선택 반경 시뮬레이터가 없을 수 있어 안내만).
  const perM2 = rent.perM2ThousandWon; // 천원/㎡
  const region = regionSi || rent.region;
  return (
    <section className="report-block mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
      <div className="flex items-center gap-2">
        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-white">
          월세 가늠
        </span>
        <h2 className="text-lg font-bold text-slate-900">소규모상가 임대료 시세</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Info label="지역" value={rent.region} />
        <Info label="㎡당 월임대료" value={`${perM2.toLocaleString()}천원`} />
        <Info label="전국 평균" value={`${rent.nationwide.toLocaleString()}천원/㎡`} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-2 font-medium">평형</th>
              <th className="py-1.5 pr-2 font-medium">전용면적(㎡)</th>
              <th className="py-1.5 font-medium">추정 월세</th>
            </tr>
          </thead>
          <tbody>
            {PYEONGS.map((p) => {
              const m2 = Math.round(p * 3.305785);
              const monthly = estimateMonthlyRent(perM2, p);
              return (
                <tr
                  key={p}
                  className={`border-b border-slate-100 ${p === 20 ? "font-semibold" : ""}`}
                >
                  <td className="py-1.5 pr-2">
                    {p}평{p === 20 && <span className="ml-1 text-xs text-slate-400">(기준)</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-500">{m2}㎡</td>
                  <td className="py-1.5">{won(monthly)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        {region} 소규모상가 ㎡당 월임대료(전용+공용) × 평형 면적으로 산출한 추정치입니다. 지역
        평균 시세이며 개별 매물 조건(층/위치/권리금)에 따라 크게 다릅니다. 출처: 한국부동산원
        상업용부동산 임대동향조사(소규모상가, {rent.asOf.slice(2, 4)}년 {rent.asOf.slice(4)}분기).
      </p>
    </section>
  );
}

// ── 서울 프리미엄 섹션 ───────────────────────────────────────────
function SeoulPremiumSection({
  premium,
  rent,
}: {
  premium: SeoulPremium;
  rent: RentInfo | null;
}) {
  const { trdar, categories } = premium;
  const withSales = categories.filter((c) => c.hasSales);
  return (
    <section className="report-block mt-8 border-t-2 border-indigo-200 pt-5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
          서울 프리미엄
        </span>
        <h2 className="text-lg font-bold text-slate-900">상권 정보 · 카드매출 추정</h2>
      </div>

      {/* 상권 정보 + 유동인구 */}
      <div className="mt-3 rounded-2xl bg-indigo-50/60 p-4 print:border print:border-slate-300 print:bg-white">
        <div className="text-sm font-semibold text-slate-800">
          최근접 상권: {trdar.trdarName}
          <span className="ml-1 text-xs font-normal text-slate-400">
            (진단 지점에서 {trdar.distanceM}m · {trdar.adstrd})
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Info label="분기 유동인구" value={trdar.flpopTot.toLocaleString()} />
          <Info label="남성" value={trdar.flpopMale.toLocaleString()} />
          <Info label="여성" value={trdar.flpopFemale.toLocaleString()} />
          <Info
            label="주요 연령대"
            value={
              trdar.topAges.length
                ? trdar.topAges.map((a) => a.label).join(" · ")
                : "-"
            }
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          유동인구 = 서울시 길단위인구(상권 단위, {trdar.flpopAsOf} 분기 합계). 성별·연령 상위 2개
          대역 표기.
        </p>
      </div>

      {/* 카드매출 추정 */}
      {withSales.length > 0 ? (
        <div className="mt-4 space-y-3">
          {categories.map((c) =>
            c.hasSales ? (
              <div
                key={c.category}
                className="rounded-xl border border-slate-200 p-4 print:border-slate-300"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{c.label}</h3>
                  {c.approx && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">
                      근사 매핑
                    </span>
                  )}
                </div>
                {c.approx && (
                  <p className="mt-0.5 text-xs text-slate-400">{c.basis}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Info label="점포당 월 추정매출" value={won(c.perStoreMonthlyAmt ?? 0)} />
                  <Info label="상권 분기 매출" value={won(c.quarterSalesAmt ?? 0)} />
                  <Info label="점포수" value={`${(c.stores ?? 0).toLocaleString()}곳`} />
                  <Info
                    label="개업률 / 폐업률"
                    value={`${c.openRate ?? 0}% / ${c.closeRate ?? "-"}${c.closeRate !== undefined ? "%" : ""}`}
                  />
                </div>

                {/* 무인 특화: 심야·주말 매출 비중 + 규칙 판정 */}
                {c.nightPct !== undefined && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 print:border print:border-slate-300 print:bg-white">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-semibold text-slate-700">
                        🌙 심야 매출 비중 <span className="text-indigo-700">{c.nightPct}%</span>
                        <span className="ml-1 text-xs font-normal text-slate-400">(21~06시)</span>
                      </span>
                      {c.weekendPct !== undefined && (
                        <span className="font-semibold text-slate-700">
                          · 주말 <span className="text-indigo-700">{c.weekendPct}%</span>
                        </span>
                      )}
                    </div>
                    {c.nightVerdict && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.nightVerdict}</p>
                    )}
                  </div>
                )}

                {/* 분기 매출 추이 스파크라인 */}
                {c.trend && c.trend.length >= 2 && (
                  <SalesTrend trend={c.trend} yoyPct={c.yoyPct ?? null} />
                )}

                <p className="mt-2 text-[11px] text-slate-400">
                  점포당 월 추정매출 = 상권 분기 카드매출 ÷ 점포수 ÷ 3. 분기 결제 건수{" "}
                  {(c.salesCnt ?? 0).toLocaleString()}건 · 매출 {c.salesAsOf} / 점포 {c.storesAsOf}{" "}
                  분기.
                </p>
              </div>
            ) : (
              <div
                key={c.category}
                className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400"
              >
                <b className="text-slate-500">{c.label}</b> — {c.basis}
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
          {categories.map((c) => (
            <div key={c.category}>
              <b className="text-slate-500">{c.label}</b> — {c.basis}
            </div>
          ))}
        </div>
      )}

      {/* 예상수익 시뮬레이터 */}
      <RevenueSimulator categories={withSales} rent={rent} />

      {/* 면책 */}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        본 카드매출은 카드사 결제 데이터 기반 <b>추정치</b>로, 매장·건물·상권과 관련된 어떠한 사실도
        증명하지 않으며 경향 분석을 위한 참고 자료입니다. 상권 단위 추정이며 개별 점포의 실제 매출과
        다릅니다. 출처: 서울시 상권분석서비스(서울신용보증재단).
      </p>
    </section>
  );
}

// ── 경기 프리미엄 섹션 ───────────────────────────────────────────
// 서울과 달리 유동인구·점포수·추이 없음(단일 분기). 상권 카드매출 + 점포당(카카오 count 분모).
function GyeonggiPremiumSection({
  premium,
  rent,
}: {
  premium: GyeonggiPremium;
  rent: RentInfo | null;
}) {
  const { trdar, categories } = premium;
  const withSales = categories.filter((c) => c.hasSales);
  // 시뮬레이터 프리필용 — SeoulCatDetail 형태로 어댑트(label/perStoreMonthlyAmt만 사용됨).
  const simCats: SeoulCatDetail[] = withSales.map((c) => ({
    category: c.category,
    label: c.label,
    hasSales: true,
    approx: c.approx,
    basis: c.basis,
    perStoreMonthlyAmt: c.perStoreMonthlyAmt,
  }));
  return (
    <section className="report-block mt-8 border-t-2 border-emerald-200 pt-5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
          경기 프리미엄
        </span>
        <h2 className="text-lg font-bold text-slate-900">상권 정보 · 카드매출 추정</h2>
      </div>

      {/* 상권 정보 */}
      <div className="mt-3 rounded-2xl bg-emerald-50/60 p-4 print:border print:border-slate-300 print:bg-white">
        <div className="text-sm font-semibold text-slate-800">
          최근접 상권: {trdar.trdarName}
          <span className="ml-1 text-xs font-normal text-slate-400">
            (진단 지점에서 {trdar.distanceM}m)
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          경기 상권은 상권명 지오코딩으로 좌표를 추정하므로 위치 정밀도가 서울보다 낮을 수
          있습니다. 유동인구·점포수 데이터는 경기 공공데이터에 없어 제공되지 않습니다.
          🌙 심야·주말 매출 비중(시간대 데이터)은 현재 <b>서울만 제공</b>됩니다.
        </p>
      </div>

      {/* 카드매출 추정 */}
      {withSales.length > 0 ? (
        <div className="mt-4 space-y-3">
          {categories.map((c) =>
            c.hasSales ? (
              <div
                key={c.category}
                className="rounded-xl border border-slate-200 p-4 print:border-slate-300"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{c.label}</h3>
                  {c.approx && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">
                      근사 매핑
                    </span>
                  )}
                </div>
                {c.approx && <p className="mt-0.5 text-xs text-slate-400">{c.basis}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Info
                    label="점포당 월 추정매출"
                    value={c.perStoreMonthlyAmt ? won(c.perStoreMonthlyAmt) : "산출 불가"}
                  />
                  <Info label="상권 분기 매출" value={won(c.quarterSalesAmt ?? 0)} />
                  <Info label="상권 월 매출(추정)" value={won(c.monthlySalesAmt ?? 0)} />
                  <Info
                    label="점포당 분모(카카오)"
                    value={c.kakaoCount !== undefined ? `${c.kakaoCount.toLocaleString()}곳` : "-"}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  ❗경기 공공데이터에는 점포수가 없어, 점포당 월 추정매출 = 상권 분기 카드매출 ÷{" "}
                  <b>카카오 반경 내 매장수</b> ÷ 3 으로 근사했습니다. 상권 매출의 집계 범위와 카카오
                  매장 반경이 달라 실제 점포당 매출과 차이가 큽니다. 분기 결제 건수{" "}
                  {(c.salesCnt ?? 0).toLocaleString()}건 · {trdar.salesAsOf.slice(0, 4)}년{" "}
                  {trdar.salesAsOf.slice(4)}분기 카드매출.
                </p>
              </div>
            ) : (
              <div
                key={c.category}
                className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400"
              >
                <b className="text-slate-500">{c.label}</b> — {c.basis}
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
          {categories.map((c) => (
            <div key={c.category}>
              <b className="text-slate-500">{c.label}</b> — {c.basis}
            </div>
          ))}
        </div>
      )}

      {/* 예상수익 시뮬레이터(서울과 공용) */}
      <RevenueSimulator categories={simCats} rent={rent} />

      {/* 면책 */}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        본 카드매출은 카드사 결제 데이터 기반 <b>추정치</b>로, 매장·건물·상권과 관련된 어떠한 사실도
        증명하지 않으며 경향 분석을 위한 참고 자료입니다. 상권 단위 추정이며 개별 점포의 실제 매출과
        다릅니다. 출처: 경기도시장상권진흥원(카드매출 기반 추정), 경기데이터드림 OpenAPI. 기준 분기:{" "}
        {trdar.salesAsOf.slice(0, 4)}년 {trdar.salesAsOf.slice(4)}분기(단일 분기, 추이 미제공).
      </p>
    </section>
  );
}

// 예상수익 시뮬레이터 — 클라이언트 계산. 매출 프리필(점포당 월 추정매출) + 입력.
function RevenueSimulator({
  categories,
  rent: rentInfo,
}: {
  categories: SeoulCatDetail[];
  rent: RentInfo | null;
}) {
  const prefill = categories.find((c) => (c.perStoreMonthlyAmt ?? 0) > 0);
  const [revenue, setRevenue] = useState<number>(
    prefill?.perStoreMonthlyAmt ? Math.round(prefill.perStoreMonthlyAmt / 10000) : 0,
  ); // 만원 단위
  // 20평 기준 월세 시세(만원). 시세로 채우기 버튼용.
  const rentFill20 = rentInfo
    ? Math.round(estimateMonthlyRent(rentInfo.perM2ThousandWon, 20) / 10000)
    : null;
  const [rent, setRent] = useState<number>(150); // 만원
  const [costPct, setCostPct] = useState<number>(35); // 관리·재료비율 %
  const [invest, setInvest] = useState<number>(5000); // 초기투자 만원

  const rev = revenue * 10000;
  const rentW = rent * 10000;
  const cost = rev * (costPct / 100);
  const monthProfit = rev - rentW - cost; // 무인 특성상 인건비 기본 0
  const yearProfit = monthProfit * 12;
  const paybackMonths = monthProfit > 0 ? (invest * 10000) / monthProfit : null;

  return (
    <div className="mt-5 rounded-2xl border-2 border-slate-900 p-4 print:border-slate-400">
      <h3 className="text-base font-bold text-slate-900">예상수익 시뮬레이터</h3>
      <p className="mt-0.5 text-xs text-slate-400">
        {prefill
          ? `${prefill.label} 점포당 월 추정매출을 기본값으로 채웠습니다. 값을 바꾸면 즉시 재계산됩니다.`
          : "월 매출 등을 입력하면 손익을 계산합니다."}{" "}
        무인 특성상 인건비는 0으로 가정합니다.
      </p>
      {rentFill20 !== null && (
        <button
          type="button"
          onClick={() => setRent(rentFill20)}
          className="no-print mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-500"
        >
          월세 시세로 채우기 (20평 기준 {rentFill20.toLocaleString()}만원)
        </button>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SimInput label="월 매출(만원)" value={revenue} onChange={setRevenue} />
        <SimInput label="월세(만원)" value={rent} onChange={setRent} />
        <SimInput label="관리·재료비율(%)" value={costPct} onChange={setCostPct} />
        <SimInput label="초기투자(만원)" value={invest} onChange={setInvest} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div
          className={`rounded-xl p-3 ${monthProfit >= 0 ? "bg-emerald-50" : "bg-red-50"} print:border print:border-slate-300 print:bg-white`}
        >
          <div className="text-xs text-slate-400">월 손익</div>
          <div
            className={`text-lg font-bold ${monthProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {monthProfit >= 0 ? "+" : "−"}
            {won(Math.abs(monthProfit))}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 print:border print:border-slate-300 print:bg-white">
          <div className="text-xs text-slate-400">연 손익</div>
          <div
            className={`text-lg font-bold ${yearProfit >= 0 ? "text-slate-800" : "text-red-600"}`}
          >
            {yearProfit >= 0 ? "+" : "−"}
            {won(Math.abs(yearProfit))}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 print:border print:border-slate-300 print:bg-white">
          <div className="text-xs text-slate-400">투자 회수기간</div>
          <div className="text-lg font-bold text-slate-800">
            {paybackMonths
              ? `${Math.round(paybackMonths)}개월 (${(paybackMonths / 12).toFixed(1)}년)`
              : "회수 불가"}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        월 손익 = 월 매출 − 월세 − (월 매출 × 관리·재료비율). 회수기간 = 초기투자 ÷ 월 손익. 세금·
        카드수수료 등은 미반영한 단순 추정입니다.
      </p>
    </div>
  );
}

function SimInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-900"
      />
    </label>
  );
}
