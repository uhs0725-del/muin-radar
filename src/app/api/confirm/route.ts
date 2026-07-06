import { NextRequest, NextResponse } from "next/server";
import { PRICES, productFromOrderId } from "@/lib/pricing";
import { ENT_COOKIE, ENT_TTL_DAYS, signEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

// ⚠️ 테스트 결제 모드. 토스 공식 문서 공개 테스트 시크릿 키 — 실제 결제 발생 안 함.
//    라이브 전환 시 Vercel 환경변수 TOSS_SECRET_KEY = live_gsk_... 로 교체.
const TOSS_SECRET =
  process.env.TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";

/**
 * 결제 승인 — 서버에서만 시크릿 키로 토스 confirm 호출.
 * 클라이언트가 보낸 amount를 신뢰하지 않고 상품 허용 금액(₩9,900)과 대조 후 confirm.
 * 성공(DONE) 시 서버 서명 엔타이틀먼트 쿠키를 심어 상세 리포트 게이트 + 30일 무제한 진단 해제.
 */
export async function POST(req: NextRequest) {
  let body: { paymentKey?: string; orderId?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const { paymentKey, orderId, amount } = body;
  if (!paymentKey || !orderId || typeof amount !== "number") {
    return NextResponse.json({ message: "필수 파라미터 누락." }, { status: 400 });
  }

  // 금액 검증: orderId로 상품 판별 → 허용 금액과 대조(amount 조작 방지)
  const product = productFromOrderId(orderId);
  if (product !== "report" || amount !== PRICES.report) {
    return NextResponse.json(
      { message: `결제 금액이 올바르지 않습니다. (허용 금액: ${PRICES.report}원)` },
      { status: 400 },
    );
  }

  const credentials = Buffer.from(`${TOSS_SECRET}:`, "utf-8").toString("base64");

  const res = await fetch(CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const result = await res.json();

  // 성공은 res.ok && status === "DONE"만. 그 외는 토스 원문 노출 금지 — 정제 메시지로 통일.
  if (!res.ok || result?.status !== "DONE") {
    return NextResponse.json(
      { message: "결제가 완료되지 않았습니다.", code: result?.code ?? null },
      { status: res.ok ? 402 : res.status },
    );
  }

  const okRes = NextResponse.json({
    status: result.status,
    orderId: result.orderId,
    totalAmount: result.totalAmount,
    method: result.method,
    approvedAt: result.approvedAt,
  });

  // 엔타이틀먼트 쿠키 발급 → 상세 리포트 게이트 통과 + 30일 무제한 진단.
  const token = signEntitlement(orderId);
  okRes.cookies.set(ENT_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * ENT_TTL_DAYS,
  });

  return okRes;
}
