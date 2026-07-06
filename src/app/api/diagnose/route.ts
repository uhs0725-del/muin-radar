import { NextRequest, NextResponse } from "next/server";
import { diagnose } from "@/lib/engine";
import { CATEGORY_MAP } from "@/lib/categories";

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
  if (!process.env.KAKAO_REST_KEY) {
    return NextResponse.json(
      { ok: false, error: "서버에 KAKAO_REST_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const result = await diagnose(address, categories, radius);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `진단 중 오류: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
