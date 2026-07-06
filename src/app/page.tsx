"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";

interface ScoreResult {
  score: number;
  metric: string;
  light: "green" | "yellow" | "red";
  verdict: string;
  storesPer10kPop?: number;
  nationalTopPct?: number;
  densityPerKm2: number;
}
interface CategoryResult {
  category: string;
  label: string;
  measurable: true | "proxy" | false;
  note?: string;
  count: number | null;
  sample: string[];
  score?: ScoreResult;
}
interface Diagnosis {
  ok: boolean;
  error?: string;
  addressNorm?: string;
  region?: { si: string; gu: string; dong: string } | null;
  population?: { pop: number; sede: number } | null;
  radiusM: number;
  mode: string;
  results: CategoryResult[];
}

const LIGHT_BG: Record<string, string> = {
  green: "bg-sat-green",
  yellow: "bg-sat-yellow",
  red: "bg-sat-red",
};
const LIGHT_TEXT: Record<string, string> = {
  green: "text-sat-green",
  yellow: "text-sat-yellow",
  red: "text-sat-red",
};

export default function Home() {
  const RADII = [500, 1000, 2000, 3000] as const;
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState<number>(1000);
  const [selected, setSelected] = useState<string[]>(["studycafe", "laundry"]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Diagnosis | null>(null);

  function toggle(key: string) {
    setSelected((s) =>
      s.includes(key) ? s.filter((k) => k !== key) : [...s, key],
    );
  }

  async function run() {
    if (!address.trim() || !selected.length) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, categories: selected, radius }),
      });
      setData(await res.json());
    } catch (e) {
      setData({
        ok: false,
        error: `요청 실패: ${(e as Error).message}`,
        radiusM: radius,
        mode: "",
        results: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">무인업종 상권 포화도 진단</h1>
        <p className="mt-1 text-sm text-slate-500">
          주소와 업종을 고르면, 반경 내 경쟁 매장을 인구 대비로 환산해 포화도 신호등으로 알려줍니다.
        </p>
      </header>

      {/* 입력 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">주소 / 지하철역</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="예: 서울 노원구 상계동, 강남역, 부천시 중동"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
        />

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
              {r >= 1000 ? `${r / 1000}km` : `${r}m`}
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
                  title={c.note || ""}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                      : on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {c.label}
                  {c.measurable === "proxy" && (
                    <span className="ml-1 text-xs opacity-70">*전체</span>
                  )}
                  {disabled && <span className="ml-1 text-xs">준비중</span>}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || !address.trim() || !selected.length}
          className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "진단 중…" : "포화도 진단 시작"}
        </button>
      </section>

      {/* 로딩 */}
      {loading && (
        <div className="mt-6 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400">
          카카오 로컬 검색 → 행정동 인구 매칭 → 포화도 계산 중…
        </div>
      )}

      {/* 결과 */}
      {data && !loading && (
        <section className="mt-6 space-y-4">
          {!data.ok ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {data.error}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm text-slate-500">{data.addressNorm}</div>
                {data.region && (
                  <div className="mt-0.5 text-base font-semibold">
                    {data.region.si} {data.region.gu} {data.region.dong} · 반경{" "}
                    {data.radiusM >= 1000 ? `${data.radiusM / 1000}km` : `${data.radiusM}m`}
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-400">{data.mode}</div>
              </div>

              {data.results.map((r) => (
                <ResultCard key={r.category} r={r} />
              ))}

              <p className="px-1 text-xs leading-relaxed text-slate-400">
                ※ 점수는 잠정 기준입니다. 매장 수는 카카오 로컬 검색(반경 기준), 인구는 중심 행정동
                거주인구로 환산했습니다. 상업·오피스 지역은 유동인구가 많아 포화도가 과소평가될 수
                있습니다. 카카오 데이터에 없는 무인 구분(예: 무인편의점)은 측정하지 않거나 전체 업종으로
                대체 표시합니다.
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function ResultCard({ r }: { r: CategoryResult }) {
  if (r.count === null || !r.score) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="font-semibold text-slate-700">{r.label}</div>
        <div className="mt-1 text-sm text-slate-400">{r.note || "측정 불가"}</div>
      </div>
    );
  }
  const s = r.score;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">
            {r.label}
            {r.measurable === "proxy" && (
              <span className="ml-1 text-xs font-normal text-slate-400">(전체 업종)</span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">
            반경 내 {r.count.toLocaleString()}곳
            {s.storesPer10kPop !== undefined && (
              <> · 인구 만명당 {s.storesPer10kPop}곳</>
            )}
          </div>
          {s.nationalTopPct !== undefined && (
            <div className={`mt-1 text-xs font-semibold ${LIGHT_TEXT[s.light]}`}>
              전국 동 대비 상위 {s.nationalTopPct}% 포화
            </div>
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className={`h-3.5 w-3.5 rounded-full ${LIGHT_BG[s.light]}`} />
          <span className={`mt-1 text-2xl font-bold ${LIGHT_TEXT[s.light]}`}>
            {s.score}
          </span>
        </div>
      </div>

      <div className={`mt-3 text-sm font-semibold ${LIGHT_TEXT[s.light]}`}>{s.verdict}</div>

      {r.measurable === "proxy" && r.note && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {r.note}
        </div>
      )}

      {r.sample.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.sample.map((name, i) => (
            <span
              key={i}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
