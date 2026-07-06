import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "환불규정 · 무인업종 상권 포화도 진단",
};

export default function RefundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← 홈으로
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">환불규정</h1>
      <p className="mt-1 text-sm text-slate-400">시행일: 2026년 7월 6일</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-base font-bold text-slate-900">제1조 (환불 대상 상품)</h2>
          <p className="mt-2">
            본 규정은 민트초코자전거(이하 &ldquo;회사&rdquo;)가 제공하는 유료 이용권(₩9,900 · 30일
            무제한 진단 + 상세 리포트 PDF 열람, 자동갱신 아님)에 적용됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제2조 (전액 환불)</h2>
          <p className="mt-2">
            이용자는 다음 요건을 <b>모두</b> 충족하는 경우 전액 환불을 받을 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>결제일로부터 <b>7일 이내</b>일 것</li>
            <li>
              유료 기능을 <b>사용 개시하지 않았을 것</b> — 즉, 상세 리포트(PDF)를 열람하지 않았고,
              유료 이용권으로 무제한 진단을 이용하지 않은 경우
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제3조 (사용 개시 후 청약철회 제한)</h2>
          <p className="mt-2">
            본 이용권은 결제 즉시 콘텐츠 열람·이용이 가능한 <b>디지털 콘텐츠</b>입니다. 따라서 이용자가
            상세 리포트를 열람하거나 유료 이용권으로 진단을 이용하는 등 <b>재화의 사용이 개시된
            경우</b>, 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호의 취지에 따라
            청약철회가 제한될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제4조 (서비스 장애 시 환불)</h2>
          <p className="mt-2">
            사용 개시 여부와 관계없이, <b>회사의 귀책 사유로 인한 서비스 장애</b>로 이용자가 정상적으로
            서비스를 이용할 수 없는 경우에는 이용 불가 기간 또는 잔여 이용기간에 상응하는 금액을 환불해
            드립니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제5조 (환불 신청 방법 및 처리)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              환불 신청은 아래 연락처로 <b>결제 일시</b>와 <b>결제 수단</b>을 알려 주시면 접수됩니다.
            </li>
            <li>환불 문의: 010-5965-1609</li>
            <li>
              접수 확인 후 <b>영업일 기준 3일 이내</b>에 처리하며, 환불은 원 결제수단으로 이루어집니다.
              결제 대행사(토스페이먼츠) 및 카드사의 정산 일정에 따라 실제 환불 반영까지 다소 시일이 걸릴
              수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">사업자 정보</h2>
          <p className="mt-2">
            상호명: 민트초코자전거 · 대표자 엄형섭
            <br />
            사업자등록번호: 344-03-03591
            <br />
            통신판매업신고번호: 제 2026-경기오산-0276 호
            <br />
            사업장주소: 경기도 오산시 오산로 190번길 42, 조이상사 2층 230호(원동)
            <br />
            연락처: 010-5965-1609
          </p>
          <p className="mt-3 text-xs text-slate-400">
            관련{" "}
            <Link href="/terms" className="underline">
              이용약관
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="underline">
              개인정보처리방침
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
