import { NextRequest, NextResponse } from "next/server";
import { ENT_COOKIE, ENT_TTL_DAYS, signEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠️ 개발/검증 전용 — 프로덕션(NODE_ENV==="production")에선 404.
 * 토스 위젯 없이 엔타이틀먼트 쿠키를 발급해 유료 게이트(상세 리포트/무제한 진단)를
 * 로컬에서 실측 검증하기 위한 엔드포인트. 라이브에는 노출되지 않음.
 */
export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const token = signEntitlement("dev_grant");
  const res = NextResponse.json({ ok: true, granted: true, ttlDays: ENT_TTL_DAYS });
  res.cookies.set(ENT_COOKIE, token, {
    httpOnly: true,
    secure: false, // 로컬 http 테스트용
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * ENT_TTL_DAYS,
  });
  return res;
}
