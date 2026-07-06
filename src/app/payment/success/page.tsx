"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setUnlocked } from "@/lib/pricing";

function SuccessInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"confirming" | "done" | "error">("confirming");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));
    if (!paymentKey || !orderId || !amount) {
      setState("error");
      setMsg("결제 정보가 올바르지 않습니다.");
      return;
    }
    fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (ok && data.status === "DONE") {
          setUnlocked(orderId);
          setState("done");
          // 결제 전 저장해둔 진단 컨텍스트가 있으면 상세 리포트로, 없으면 홈으로.
          const hasCtx = (() => {
            try {
              return !!localStorage.getItem("mr_report_ctx");
            } catch {
              return false;
            }
          })();
          setTimeout(() => router.replace(hasCtx ? "/report" : "/"), 1200);
        } else {
          setState("error");
          setMsg(data.message || "결제 승인에 실패했습니다.");
        }
      })
      .catch(() => {
        setState("error");
        setMsg("결제 승인 중 오류가 발생했습니다.");
      });
  }, [params, router]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {state === "confirming" && (
        <>
          <div className="mb-3 text-4xl">⏳</div>
          <h1 className="text-lg font-bold text-slate-900">결제를 확인하고 있어요…</h1>
        </>
      )}
      {state === "done" && (
        <>
          <div className="mb-3 text-4xl">✅</div>
          <h1 className="text-lg font-bold text-emerald-600">결제 완료!</h1>
          <p className="mt-1 text-sm text-slate-500">
            상세 리포트가 해제되었습니다. 잠시 후 이동합니다…
          </p>
        </>
      )}
      {state === "error" && (
        <>
          <div className="mb-3 text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-red-600">결제 확인 실패</h1>
          <p className="mt-1 text-sm text-slate-500">{msg}</p>
          <button
            onClick={() => router.replace("/checkout")}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
        </>
      )}
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center text-slate-400">로딩 중…</main>}>
      <SuccessInner />
    </Suspense>
  );
}
