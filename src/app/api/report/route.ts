import { NextRequest, NextResponse } from "next/server";
import { detailedReport } from "@/lib/engine";
import { CATEGORY_MAP } from "@/lib/categories";
import { ENT_COOKIE, verifyEntitlement } from "@/lib/entitlement";
import { conclusionForCategory, overallSummary } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 상세 리포트 데이터 — 유료 게이트. 엔타이틀먼트 쿠키(₩19,900 결제) 없으면 402.
 * 4개 반경 비교 + 전체 경쟁매장 리스트(거리) + 규칙 기반 종합 결론.
 */
export async function POST(req: NextRequest) {
  // 진짜 게이트: 서버 서명 엔타이틀먼트 쿠키 검증. 미결제면 카카오 호출 전에 402.
  const ent = verifyEntitlement(req.cookies.get(ENT_COOKIE)?.value);
  if (!ent) {
    return NextResponse.json(
      { ok: false, error: "상세 리포트는 결제 후 이용할 수 있습니다." },
      { status: 402 },
    );
  }

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

  try {
    const report = await detailedReport(address, categories, radius);
    if (!report.ok) {
      return NextResponse.json(report, { status: 200 });
    }
    // 규칙 기반 결론(LLM 없음) 부착
    const conclusions = report.categories.map((c) => ({
      category: c.category,
      text: conclusionForCategory(c, radius),
    }));
    return NextResponse.json({
      ...report,
      summary: overallSummary(report),
      conclusions,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `리포트 생성 중 오류: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
