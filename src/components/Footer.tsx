import Link from "next/link";

/**
 * 공통 푸터 — 전 페이지 하단에 노출(토스/카드사 전자결제 심사 요건: 사업자 정보 표기).
 * 인쇄(@media print)에서는 .no-print로 숨겨 리포트 PDF에 섞이지 않게 한다.
 */
export default function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-2xl px-4 py-8 text-xs leading-relaxed text-slate-400">
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-slate-500">
          <Link href="/terms" className="hover:text-slate-900">
            이용약관
          </Link>
          <span aria-hidden>|</span>
          <Link href="/privacy" className="hover:text-slate-900">
            개인정보처리방침
          </Link>
          <span aria-hidden>|</span>
          <Link href="/refund" className="hover:text-slate-900">
            환불규정
          </Link>
        </div>

        <div className="mt-3 space-y-0.5">
          <p>상호명: 민트초코자전거 · 대표자명: 엄형섭</p>
          <p>사업자등록번호: 344-03-03591</p>
          <p>통신판매업신고번호: 제 2026-경기오산-0276 호</p>
          <p>사업장주소: 경기도 오산시 오산로 190번길 42, 조이상사 2층 230호(원동)</p>
          <p>연락처: 010-5965-1609</p>
        </div>

        <p className="mt-3 text-slate-400">
          © 2026 민트초코자전거. 진단 결과는 공공·지도 데이터 기반 참고용 추정이며 창업·투자
          결정의 근거로 삼기 전 반드시 현장 확인이 필요합니다.
        </p>
      </div>
    </footer>
  );
}
