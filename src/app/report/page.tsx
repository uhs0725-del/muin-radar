"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReportView, { type ReportData } from "@/components/ReportView";
import { PRICES } from "@/lib/pricing";

interface Ctx {
  address: string;
  categories: string[];
  radius: number;
}

export default function ReportPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "paywall" | "ready" | "error">("loading");
  const [data, setData] = useState<ReportData | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let c: Ctx | null = null;
    try {
      const raw = localStorage.getItem("mr_report_ctx");
      if (raw) c = JSON.parse(raw);
    } catch {
      c = null;
    }
    if (!c || !c.address || !c.categories?.length) {
      setState("error");
      setMsg("리포트를 생성할 진단 정보가 없습니다. 먼저 진단을 실행하세요.");
      return;
    }
    setCtx(c);
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: c.address, categories: c.categories, radius: c.radius }),
    })
      .then(async (r) => ({ status: r.status, data: await r.json() }))
      .then(({ status, data }) => {
        if (status === 402) {
          setState("paywall");
          return;
        }
        if (!data.ok) {
          setState("error");
          setMsg(data.error || "리포트를 불러오지 못했습니다.");
          return;
        }
        setData(data);
        setState("ready");
      })
      .catch(() => {
        setState("error");
        setMsg("리포트 요청 중 오류가 발생했습니다.");
      });
  }, []);

  if (state === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-400">
        상세 리포트를 생성하는 중… (반경 4개 × 업종 수집)
      </main>
    );
  }

  if (state === "paywall") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mb-3 text-4xl">🔒</div>
        <h1 className="text-lg font-bold text-slate-900">상세 리포트는 유료입니다</h1>
        <p className="mt-2 text-sm text-slate-500">
          ₩{PRICES.report.toLocaleString("ko-KR")} · 14일 무제한 진단 + 상세 PDF 리포트. 경쟁 매장
          전체 리스트(거리), 4개 반경 비교 테이블, 종합 결론을 A4 인쇄용으로 제공합니다.
        </p>
        <button
          onClick={() => router.push("/checkout")}
          className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          ₩{PRICES.report.toLocaleString("ko-KR")} 결제하고 리포트 보기
        </button>
        <button
          onClick={() => router.push("/report/sample")}
          className="mt-3 text-sm text-slate-500 underline hover:text-slate-900"
        >
          예시 리포트 먼저 보기
        </button>
        <div className="mt-2">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-400 hover:text-slate-700"
          >
            ← 진단으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mb-3 text-4xl">⚠️</div>
        <p className="text-sm text-slate-500">{msg}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          진단으로
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:py-0">
      {/* 인쇄/이동 바 — 인쇄 시 숨김 */}
      <div className="no-print mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← 진단으로
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          📄 PDF로 저장 / 인쇄
        </button>
      </div>

      <ReportView data={data} categoryKeys={ctx?.categories ?? []} showCoupang />
    </main>
  );
}
