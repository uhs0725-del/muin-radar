import { NextRequest, NextResponse } from "next/server";
import { diagnose } from "@/lib/engine";
import { CATEGORY_MAP } from "@/lib/categories";
import {
  ENT_COOKIE,
  QUOTA_COOKIE,
  FREE_DAILY_LIMIT,
  verifyEntitlement,
  readQuota,
  signQuota,
} from "@/lib/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { address?: string; categories?: string[]; radius?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
  }
  const address = (body.address || "").trim();
  const categories = (body.categories || []).filter((k) => CATEGORY_MAP[k]);
  const ALLOWED_RADII = [500, 1000, 2000, 3000];
  const radius = ALLOWED_RADII.includes(body.radius as number)
    ? (body.radius as number)
    : 1000;

  if (!address) {
    return NextResponse.json({ ok: false, error: "주소를 입력하세요." }, { status: 400 });
  }
  if (!categories.length) {
    return NextResponse.json(
      { ok: false, error: "업종을 1개 이상 선택하세요." },
      { status: 400 },
    );
  }

  // 결제(엔타이틀먼트) 있으면 당일 무제한 → 쿼터 체크 스킵.
  const paid = !!verifyEntitlement(req.cookies.get(ENT_COOKIE)?.value);

  let quota = readQuota(req.cookies.get(QUOTA_COOKIE)?.value);
  if (!paid) {
    if (quota.used >= FREE_DAILY_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          quotaExceeded: true,
          error: `오늘 무료 진단 ${FREE_DAILY_LIMIT}회를 다 썼습니다. ₩9,900 상세 리포트를 결제하면 30일 무제한 진단 + 상세 PDF 리포트를 이용할 수 있어요.`,
        },
        { status: 402 },
      );
    }
  }

  try {
    const result = await diagnose(address, categories, radius);
    const res = NextResponse.json({
      ...result,
      paid,
      freeLimit: FREE_DAILY_LIMIT,
      freeUsed: paid ? 0 : quota.used + 1,
      freeRemaining: paid ? null : Math.max(0, FREE_DAILY_LIMIT - (quota.used + 1)),
    });

    // 무료 사용자면 카운터 증가 후 쿠키 재발급(성공한 진단만 카운트).
    if (!paid) {
      quota = { date: quota.date, used: quota.used + 1 };
      res.cookies.set(QUOTA_COOKIE, signQuota(quota), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 2, // 2일(날짜 검증으로 자연 리셋)
      });
    }
    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `진단 중 오류: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
