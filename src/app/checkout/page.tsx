"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { PRICES, ORDER_NAMES, makeOrderId } from "@/lib/pricing";

// ⚠️ 테스트 결제 모드 — 토스 공식 문서 공개 테스트 클라이언트 키(실제 청구 없음).
//    라이브 전환 시 Vercel 환경변수 NEXT_PUBLIC_TOSS_CLIENT_KEY = live_gck_... 로 교체.
const CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

type Widgets = ReturnType<Awaited<ReturnType<typeof loadTossPayments>>["widgets"]>;

function CheckoutInner() {
  const router = useRouter();
  const widgetsRef = useRef<Widgets | null>(null);
  const orderIdRef = useRef<string>(makeOrderId());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const amount = PRICES.report;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const toss = await loadTossPayments(CLIENT_KEY);
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ value: amount, currency: "KRW" });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        if (cancelled) return;
        widgetsRef.current = widgets;
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제 위젯을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount]);

  async function pay() {
    if (!widgetsRef.current) return;
    setPaying(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId: orderIdRef.current,
        orderName: ORDER_NAMES.report,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (e) {
      setPaying(false);
      setError(e instanceof Error ? e.message : "결제 요청에 실패했습니다.");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <button
        onClick={() => router.push("/")}
        className="mb-4 text-sm text-slate-500 hover:text-slate-900"
      >
        ← 돌아가기
      </button>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">
          상세 리포트(PDF) + 14일 무제한 진단
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          선택 업종의 경쟁 매장 전체 리스트(거리 포함), 4개 반경(500m·1km·2km·3km) 비교 테이블,
          종합 결론을 A4 인쇄용 리포트로 제공합니다. 결제하면 14일간 무료 진단 횟수 제한 없이
          이용할 수 있어요.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          14일 이용권입니다(자동갱신 아님). 결제한 브라우저에서 이용하세요 — 계정이 없어 쿠키를
          삭제하거나 다른 브라우저에서는 이용권이 인식되지 않습니다.
        </p>
        <p className="mt-3 text-2xl font-extrabold text-slate-900">
          ₩{PRICES.report.toLocaleString("ko-KR")}{" "}
          <span className="text-sm font-medium text-slate-400">· 14일 이용권</span>
        </p>
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          시중 상권분석 단건 리포트 <b>55,000원</b>(나이스비즈맵 프리미엄) 상당의 분석을 즉시
          발급합니다.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div id="payment-method" />
      <div id="agreement" />

      <button
        onClick={pay}
        disabled={!ready || paying}
        className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {paying
          ? "결제 진행 중…"
          : ready
            ? `₩${amount.toLocaleString("ko-KR")} 결제하기`
            : "결제 수단 불러오는 중…"}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-slate-400">
        결제 후 7일 이내이고 유료 기능(상세 리포트 열람·무제한 진단) 사용 개시 전이면 전액 환불됩니다.
        자세한 내용은{" "}
        <Link href="/refund" className="underline hover:text-slate-600">
          환불규정
        </Link>{" "}
        참조.
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        테스트 모드입니다 · 실제 금액이 청구되지 않습니다
      </p>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center text-slate-400">로딩 중…</main>}>
      <CheckoutInner />
    </Suspense>
  );
}
