// 예시 리포트 스냅샷 재생성 — 강남역 기준, 서울 프리미엄 섹션 포함.
// 사용: dev 서버(:3003) 실행 중에 node scripts/gen_sample.mjs
// dev-grant로 엔타이틀먼트 쿠키 받아 /api/report 호출 → src/data/sample_report.json 저장.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:3003";
const CATS = ["studycafe", "laundry", "photobooth", "icecream", "convenience"];

async function main() {
  // 1) dev-grant → 엔타이틀먼트 쿠키
  const g = await fetch(`${BASE}/api/dev-grant`, { method: "POST" });
  const setCookie = g.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0]; // mr_ent=...
  if (!cookie.startsWith("mr_ent=")) {
    throw new Error(`dev-grant 실패: ${g.status} ${setCookie}`);
  }

  // 2) 상세 리포트
  const r = await fetch(`${BASE}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ address: "강남역", categories: CATS, radius: 1000 }),
  });
  const data = await r.json();
  if (!data.ok) throw new Error(`report 실패: ${r.status} ${JSON.stringify(data).slice(0, 200)}`);

  // 3) sampleAsOf 부여(생성시각 노출 대신 데이터 기준일)
  data.sampleAsOf = data.seoul?.trdar?.flpopAsOf
    ? `${data.seoul.trdar.flpopAsOf} 분기`
    : "2026-07-01";

  const out = path.join(process.cwd(), "src", "data", "sample_report.json");
  fs.writeFileSync(out, JSON.stringify(data, null, 1), "utf-8");
  console.log(
    "saved sample_report.json",
    "categories:",
    data.categories?.length,
    "seoul:",
    !!data.seoul,
    "trdar:",
    data.seoul?.trdar?.trdarName,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
