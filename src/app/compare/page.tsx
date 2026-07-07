"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { PRICES } from "@/lib/pricing";

// ── 응답 타입(서버 lib/compare 축약 결과) ──
interface CatMetric {
  category: string;
  label: string;
  measurable: true | "proxy" | false;
  count: number | null;
  light: "green" | "yellow" | "red" | null;
  nationalTopPct?: number;
  residTopPct?: number;
  flpopTopPct?: number;
  perStoreMonthlyAmt?: number; // 서울만
  monthlySalesAmt?: number; // 경기 상권 월 카드매출 총액
  perTxnAmt?: number; // 경기 건당 결제단가
  nightPct?: number;
}
interface Site {
  address: string;
  addressNorm?: string;
  region?: { si: string; gu: string; dong: string } | null;
  population?: { pop: number; sede: number } | null;
  inSeoul: boolean;
  inGyeonggi: boolean;
  trdarName?: string;
  flpopTot?: number;
  rentPerM2?: number;
  cats: CatMetric[];
  avgHeadroom: number | null;
  worstLight: "green" | "yellow" | "red" | null;
}
interface CompareResp {
  ok: boolean;
  error?: string;
  radiusM: number;
  categories: { key: string; label: string }[];
  sites: Site[];
  verdict: string;
  bestIndex: number | null;
  failedAddresses?: string[];
  generatedAt?: string;
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
function won(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만원`;
  return `${Math.round(n).toLocaleString()}원`;
}
function siteName(s: Site): string {
  return s.region?.dong || s.addressNorm || s.address;
}

export default function ComparePage() {
  const router = useRouter();
  const RADII = [500, 1000, 2000, 3000] as const;
  const [addrs, setAddrs] = useState<string[]>(["", ""]);
  const [radius, setRadius] = useState<number>(1000);
  const [selected, setSelected] = useState<string[]>(["studycafe", "laundry"]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CompareResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 최근 진단 주소 프리필(있으면 첫 칸에).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mr_report_ctx");
      if (raw) {
        const c = JSON.parse(raw);
        if (c?.address) setAddrs((a) => (a[0] ? a : [c.address, a[1] ?? ""]));
        if (Array.isArray(c?.categories) && c.categories.length) setSelected(c.categories);
        if (typeof c?.radius === "number") setRadius(c.radius);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function setAddr(i: number, v: string) {
    setAddrs((a) => a.map((x, j) => (j === i ? v : x)));
  }
  function addField() {
    setAddrs((a) => (a.length >= 3 ? a : [...a, ""]));
  }
  function removeField(i: number) {
    setAddrs((a) => (a.length <= 2 ? a : a.filter((_, j) => j !== i)));
  }
  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  async function run() {
    const addresses = addrs.map((a) => a.trim()).filter(Boolean);
    if (addresses.length < 2 || !selected.length) return;
    setLoading(true);
    setData(null);
    setErr(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses, categories: selected, radius }),
      });
      if (res.status === 402) {
        router.push("/checkout");
        return;
      }
      const json: CompareResp = await res.json();
      if (!json.ok) {
        setErr(json.error || "비교에 실패했습니다.");
      } else {
        setData(json);
      }
    } catch (e) {
      setErr(`요청 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 print:py-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← 진단으로
        </button>
        {data && (
          <button
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            📄 PDF로 저장 / 인쇄
          </button>
        )}
      </div>

      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">🆚 후보지 비교</h1>
        <p className="mt-1 text-sm text-slate-500">
          자리 2~3곳을 같은 업종·반경으로 나란히 비교해 어디가 유리한지 규칙 기반으로 판정합니다.
          (유료 전용 · 결제 후 이용)
        </p>
      </header>

      {/* 입력 */}
      <section className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">후보 주소 (2~3곳)</label>
        <div className="mt-2 space-y-2">
          {addrs.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={a}
                onChange={(e) => setAddr(i, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder={`후보 ${i + 1}: 예: 강남역 / 오산시 원동`}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
              />
              {addrs.length > 2 && (
                <button
                  onClick={() => removeField(i)}
                  className="shrink-0 rounded-xl border border-slate-300 px-3 text-sm text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {addrs.length < 3 && (
          <button
            onClick={addField}
            className="mt-2 text-xs font-medium text-slate-500 underline hover:text-slate-900"
          >
            + 후보 추가 (최대 3곳)
          </button>
        )}

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">반경</span>
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                radius === r
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {rLabel(r)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <span className="text-sm font-semibold text-slate-700">업종 (복수 선택)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = selected.includes(c.key);
              const disabled = c.measurable === false;
              return (
                <button
                  key={c.key}
                  onClick={() => !disabled && toggle(c.key)}
                  disabled={disabled}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                      : on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {c.label}
                  {c.measurable === "proxy" && <span className="ml-1 text-xs opacity-70">*전체</span>}
                  {disabled && <span className="ml-1 text-xs">준비중</span>}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || addrs.filter((a) => a.trim()).length < 2 || !selected.length}
          className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "비교 수집 중… (후보별 4개 반경 스캔)" : "후보지 비교하기"}
        </button>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </section>

      {/* 결과 */}
      {data && <CompareResult data={data} />}
    </main>
  );
}

function CompareResult({ data }: { data: CompareResp }) {
  const { sites, categories, bestIndex } = data;
  return (
    <section className="report-block mt-6">
      {/* 종합 판정 */}
      <div className="rounded-2xl border-2 border-slate-900 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏁</span>
          <h2 className="text-base font-bold text-slate-900">종합 판정</h2>
          {bestIndex !== null && (
            <span className="ml-auto rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
              1순위: {siteName(sites[bestIndex])}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{data.verdict}</p>
        <p className="mt-1 text-xs text-slate-400">
          기준 반경 {rLabel(data.radiusM)} · 여유도 = 100 − 전국 포화 백분위(높을수록 여유).
        </p>
      </div>

      {/* 후보 요약 카드 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sites.map((s, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-4 ${
              i === bestIndex ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            } print:bg-white`}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900">{siteName(s)}</span>
              {i === bestIndex && <span className="text-xs">🥇</span>}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-400">
              {s.addressNorm || s.address}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              평균 여유도 <b>{s.avgHeadroom ?? "-"}</b>
              {s.worstLight && (
                <span className={`ml-2 ${LIGHT_TEXT[s.worstLight]}`}>
                  최악 {LIGHT_KO[s.worstLight]}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {s.region ? `${s.region.si} ${s.region.gu}` : ""}
              {s.population ? ` · 거주 ${s.population.pop.toLocaleString()}명` : ""}
              {s.inSeoul ? " · 서울(유동반영)" : s.inGyeonggi ? " · 경기(카드매출)" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* 비교 테이블 */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">항목</th>
              {sites.map((s, i) => (
                <th key={i} className="py-2 pr-3 font-semibold text-slate-700">
                  {siteName(s)}
                  {i === bestIndex && " 🥇"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="행정동">
              {sites.map((s, i) => (
                <Cell key={i}>{s.region?.dong ?? "-"}</Cell>
              ))}
            </Row>
            <Row label="거주인구">
              {sites.map((s, i) => (
                <Cell key={i}>{s.population ? `${s.population.pop.toLocaleString()}명` : "-"}</Cell>
              ))}
            </Row>
            <Row label="최근접 상권">
              {sites.map((s, i) => (
                <Cell key={i}>{s.trdarName ?? "-"}</Cell>
              ))}
            </Row>
            <Row label="유동인구(서울)">
              {sites.map((s, i) => (
                <Cell key={i}>{s.flpopTot ? s.flpopTot.toLocaleString() : "-"}</Cell>
              ))}
            </Row>
            <Row label="월세(㎡당·천원)">
              {sites.map((s, i) => (
                <Cell key={i}>{s.rentPerM2 ? `${s.rentPerM2.toLocaleString()}` : "-"}</Cell>
              ))}
            </Row>

            {/* 업종별 신호등/매장수/상위%/심야/점포당매출 */}
            {categories.map((cat) => (
              <CatRows key={cat.key} cat={cat} sites={sites} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        신호등·상위%는 전국 행정동 표본 분포 대비 백분위(낮을수록 여유), 카드매출·유동인구·심야
        비중은 서울·경기 상권 데이터가 있는 후보에만 표시됩니다. 상권 단위 추정치이며 개별 점포·매물
        조건과 다릅니다. 본 비교는 참고용이며 창업 결정의 책임은 이용자에게 있습니다.
      </p>
    </section>
  );
}

function CatRows({ cat, sites }: { cat: { key: string; label: string }; sites: Site[] }) {
  const metricOf = (s: Site) => s.cats.find((c) => c.category === cat.key);
  const hasSales = sites.some((s) => (metricOf(s)?.perStoreMonthlyAmt ?? 0) > 0);
  const hasGgSales = sites.some((s) => (metricOf(s)?.monthlySalesAmt ?? 0) > 0);
  const hasTxn = sites.some((s) => (metricOf(s)?.perTxnAmt ?? 0) > 0);
  const hasNight = sites.some((s) => metricOf(s)?.nightPct !== undefined);
  return (
    <>
      <tr className="border-t-2 border-slate-200 bg-slate-50 print:bg-white">
        <td className="py-1.5 pr-3 text-xs font-bold text-slate-700" colSpan={sites.length + 1}>
          {cat.label}
        </td>
      </tr>
      <Row label="  포화 신호등">
        {sites.map((s, i) => {
          const m = metricOf(s);
          return (
            <Cell key={i}>
              {m?.light ? (
                <span className="inline-flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_DOT[m.light]}`} />
                  <span className={LIGHT_TEXT[m.light]}>{LIGHT_KO[m.light]}</span>
                </span>
              ) : (
                "-"
              )}
            </Cell>
          );
        })}
      </Row>
      <Row label="  매장수 / 전국 상위%">
        {sites.map((s, i) => {
          const m = metricOf(s);
          return (
            <Cell key={i}>
              {m && m.count !== null
                ? `${m.count.toLocaleString()}곳${m.nationalTopPct !== undefined ? ` · 상위 ${m.nationalTopPct}%` : ""}`
                : "-"}
            </Cell>
          );
        })}
      </Row>
      {hasSales && (
        <Row label="  점포당 월매출(추정, 서울)">
          {sites.map((s, i) => {
            const m = metricOf(s);
            return (
              <Cell key={i}>{m?.perStoreMonthlyAmt ? won(m.perStoreMonthlyAmt) : "-"}</Cell>
            );
          })}
        </Row>
      )}
      {hasGgSales && (
        <Row label="  상권 월매출(총액, 경기)">
          {sites.map((s, i) => {
            const m = metricOf(s);
            return <Cell key={i}>{m?.monthlySalesAmt ? won(m.monthlySalesAmt) : "-"}</Cell>;
          })}
        </Row>
      )}
      {hasTxn && (
        <Row label="  건당 결제단가(경기)">
          {sites.map((s, i) => {
            const m = metricOf(s);
            return <Cell key={i}>{m?.perTxnAmt ? won(m.perTxnAmt) : "-"}</Cell>;
          })}
        </Row>
      )}
      {hasNight && (
        <Row label="  심야 비중(서울)">
          {sites.map((s, i) => {
            const m = metricOf(s);
            return <Cell key={i}>{m?.nightPct !== undefined ? `${m.nightPct}%` : "-"}</Cell>;
          })}
        </Row>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="whitespace-pre py-1.5 pr-3 text-xs text-slate-500">{label}</td>
      {children}
    </tr>
  );
}
function Cell({ children }: { children: React.ReactNode }) {
  return <td className="py-1.5 pr-3 text-slate-700">{children}</td>;
}
