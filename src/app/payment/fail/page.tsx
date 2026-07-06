"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function FailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const message = params.get("message") || "결제가 취소되었거나 실패했습니다.";

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mb-3 text-4xl">⚠️</div>
      <h1 className="text-lg font-bold text-red-600">결제 실패</h1>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
      <button
        onClick={() => router.replace("/checkout")}
        className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        다시 시도
      </button>
    </main>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center text-slate-400">로딩 중…</main>}>
      <FailInner />
    </Suspense>
  );
}
