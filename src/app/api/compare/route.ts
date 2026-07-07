import { NextRequest, NextResponse } from "next/server";
import { detailedReport } from "@/lib/engine";
import { CATEGORY_MAP } from "@/lib/categories";
import { ENT_COOKIE, verifyEntitlement } from "@/lib/entitlement";
import { toCompareSite, buildCompareResult } from "@/lib/compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 후보지 비교 — 유료 전용(엔타이틀먼트 쿠키 없으면 402, 무료 쿼터와 무관).
 * 주소 2~3개 각각 detailedReport 수집(병렬) → 비교 지표 + 규칙 종합 판정.
 * 응답 크기 축소를 위해 stores 리스트는 축약 단계에서 제외.
 */
export async function POST(req: NextRequest) {
  const ent = verifyEntitlement(req.cookies.get(ENT_COOKIE)?.value);
  if (!ent) {
    return NextResponse.json(
      { ok: false, error: "후보지 비교는 결제 후 이용할 수 있습니다." },
      { status: 402 },
    );
  }

  let body: { addresses?: string[]; categories?: string[]; radius?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
  }

  const addresses = (body.addresses || [])
    .map((a) => (a || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const categories = (body.categories || []).filter((k) => CATEGORY_MAP[k]);
  const ALLOWED_RADII = [500, 1000, 2000, 3000];
  const radius = ALLOWED_RADII.includes(body.radius as number)
    ? (body.radius as number)
    : 1000;

  if (addresses.length < 2) {
    return NextResponse.json(
      { ok: false, error: "비교할 주소를 2개 이상 입력하세요." },
      { status: 400 },
    );
  }
  if (!categories.length) {
    return NextResponse.json(
      { ok: false, error: "업종을 1개 이상 선택하세요." },
      { status: 400 },
    );
  }

  try {
    // 각 주소 병렬 수집(카카오 호출 많음 — 유료 게이트 뒤라 허용).
    const reports = await Promise.all(
      addresses.map((a) => detailedReport(a, categories, radius)),
    );
    // 지오코딩 실패한 주소는 에러로 표기.
    const failed = reports
      .map((r, i) => ({ r, i }))
      .filter((x) => !x.r.ok)
      .map((x) => addresses[x.i]);
    const okReports = reports.filter((r) => r.ok);
    if (okReports.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          error: `비교하려면 유효한 주소가 2개 이상 필요합니다. 인식 실패: ${failed.join(", ") || "-"}`,
        },
        { status: 200 },
      );
    }

    const sites = okReports.map(toCompareSite);
    const catList = categories.map((k) => ({ key: k, label: CATEGORY_MAP[k].label }));
    const result = buildCompareResult(sites, radius, catList);

    return NextResponse.json({
      ok: true,
      ...result,
      failedAddresses: failed,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `비교 생성 중 오류: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
