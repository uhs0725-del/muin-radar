"use client";

import { useRouter } from "next/navigation";
import ReportView, { type ReportData } from "@/components/ReportView";
import sampleRaw from "@/data/sample_report.json";

// 무료 공개 예시 리포트 — 엔타이틀먼트 불필요. 정적 스냅샷(강남역, 전 업종)을 실물과
// 동일한 ReportView로 렌더. 매 방문 카카오 호출 없음(비용·쿼터·속도).
const SAMPLE = sampleRaw as unknown as ReportData;

function Cta({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      내 동네로 받아보기 → ₩9,900 · 30일 무제한 + PDF
    </button>
  );
}

export default function SampleReportPage() {
  const router = useRouter();
  const goCheckout = () => router.push("/checkout");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* 예시 배너 */}
      <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
        <div className="text-sm font-bold text-amber-800">
          📋 예시 리포트 — 강남역 기준 미리보기입니다
        </div>
        <p className="mt-0.5 text-xs text-amber-700">
          아래는 실제 상세 리포트와 동일한 구성입니다. 결제하면 이 화면을 내가 입력한 주소·업종으로
          받아볼 수 있어요. {SAMPLE.sampleAsOf ? `(${SAMPLE.sampleAsOf} 기준 데이터)` : ""}
        </p>
      </div>

      {/* 상단 CTA */}
      <div className="mb-6">
        <Cta onClick={goCheckout} />
        <button
          onClick={() => router.push("/")}
          className="mt-2 w-full text-center text-sm text-slate-400 hover:text-slate-700"
        >
          ← 내 주소로 무료 진단부터 하기
        </button>
      </div>

      {/* 실물과 동일 렌더 (쿠팡 섹션 제외 — 전환 집중) */}
      <ReportView data={SAMPLE} showCoupang={false} />

      {/* 하단 CTA */}
      <div className="mt-8 rounded-2xl border-2 border-slate-900 bg-white p-5">
        <div className="text-base font-bold text-slate-900">
          이 리포트를 내 상권으로 받아보세요
        </div>
        <p className="mt-1 text-sm text-slate-500">
          경쟁 매장 전체 리스트·4개 반경 비교·종합 결론을 내가 고른 주소와 업종으로. A4 인쇄용 PDF +
          30일 무제한 진단 포함.
        </p>
        <div className="mt-4">
          <Cta onClick={goCheckout} />
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          테스트 결제 모드 · 30일 이용권(자동갱신 아님)
        </p>
      </div>
    </main>
  );
}
