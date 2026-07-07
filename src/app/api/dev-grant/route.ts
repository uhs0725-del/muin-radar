import { NextRequest, NextResponse } from "next/server";
import { ENT_COOKIE, ENT_TTL_DAYS, signEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 오너(관리자) 그랜트 키 — 프로덕션에서 ?key= 로 맞으면 14일 이용권 발급.
// env 우선 + fallback(Private 레포, 엔타이틀먼트/카카오 키와 동일 패턴).
const ADMIN_GRANT_KEY =
  process.env.ADMIN_GRANT_KEY || "mr-owner-7d1f4c9a2b";

/**
 * 엔타이틀먼트 쿠키 발급.
 * - 개발(NODE_ENV!=production): 무조건 발급 (검증용, 기존 동작 유지)
 * - 프로덕션: ?key=<ADMIN_GRANT_KEY> 맞을 때만 발급 (오너 패스) — 틀리면 404
 * GET도 지원: 브라우저 주소창에서 바로 열어 쿠키 받기 위함.
 */
function grant(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const key = req.nextUrl.searchParams.get("key") || "";
    if (key !== ADMIN_GRANT_KEY) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }
  const token = signEntitlement(isProd ? "owner_grant" : "dev_grant");
  const res = NextResponse.json({
    ok: true,
    granted: true,
    ttlDays: ENT_TTL_DAYS,
    note: "이 브라우저에 14일 이용권 쿠키가 발급되었습니다. 홈으로 이동해 사용하세요.",
  });
  res.cookies.set(ENT_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * ENT_TTL_DAYS,
  });
  return res;
}

export async function POST(req: NextRequest) {
  return grant(req);
}

export async function GET(req: NextRequest) {
  return grant(req);
}
