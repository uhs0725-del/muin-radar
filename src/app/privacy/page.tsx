import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 무인업종 상권 포화도 진단",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← 홈으로
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-slate-400">시행일: 2026년 7월 6일</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <p>
            민트초코자전거(이하 &ldquo;회사&rdquo;)는 무인업종 상권 포화도 진단 서비스(이하
            &ldquo;서비스&rdquo;)를 제공함에 있어 이용자의 개인정보를 최소한으로만 처리합니다. 본
            서비스는 <b>회원가입·로그인·계정이 없으며</b>, 이용자를 식별하기 위한 개인정보를 별도로
            수집하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">
            제1조 (수집하는 개인정보 및 이용 목적)
          </h2>
          <p className="mt-2">회사가 처리하는 정보는 다음과 같으며, 그 범위를 최소화합니다.</p>
          <ol className="mt-3 list-decimal space-y-3 pl-5">
            <li>
              <b>결제 정보</b> — 유료 이용권 결제 시 결제 대행사인{" "}
              <b>토스페이먼츠(주)</b>가 결제 처리를 위해 카드정보 등 결제정보를 수집·처리합니다.{" "}
              <b>회사는 카드번호 등 결제수단 정보를 보유하거나 저장하지 않으며</b>, 결제 승인 결과(주문
              번호, 결제 여부)만 이용권 부여를 위해 처리합니다.
            </li>
            <li>
              <b>서비스 쿠키(2종)</b> — 개인을 식별하지 않는 기능용 쿠키입니다.
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-600">
                <li>무료 진단 횟수 카운트용 쿠키(1일 이용 제한 적용)</li>
                <li>유료 이용권 확인용 쿠키(결제 후 14일 이용권 인식)</li>
              </ul>
              위 쿠키는 이름·연락처 등 개인 식별정보를 담지 않습니다.
            </li>
            <li>
              <b>검색 주소</b> — 진단을 위해 이용자가 입력한 주소는 <b>진단 처리에만 일시적으로
              사용</b>되며, 서버에 <b>저장하지 않습니다.</b>
            </li>
            <li>
              <b>서비스 이용 로그</b> — 서비스 운영·보안을 위해 호스팅 제공사(Vercel)에서 접속 로그
              수준의 정보(접속 시각, IP 등)가 일시적으로 기록될 수 있으며, 이는 마케팅 등 다른 목적으로
              이용되지 않습니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제2조 (개인정보의 제3자 제공 및 처리위탁)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              회사는 이용자의 개인정보를 제3자에게 판매하거나 마케팅 목적으로 제공하지 않습니다.
            </li>
            <li>
              결제 처리를 위해 <b>토스페이먼츠(주)</b>에 결제정보 처리를 위탁하며, 서비스 호스팅을 위해
              <b> Vercel Inc.</b>의 인프라를 이용합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제3조 (보유 및 이용 기간)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>검색 주소: 진단 처리 즉시 폐기(저장하지 않음).</li>
            <li>서비스 쿠키: 무료 횟수 쿠키는 당일, 이용권 쿠키는 결제일로부터 최대 14일 후 만료.</li>
            <li>
              결제 관련 기록: 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령이 정한 기간 동안
              결제 대행사 및 회사가 보관할 수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제4조 (이용자의 권리)</h2>
          <p className="mt-2">
            이용자는 언제든지 브라우저 설정을 통해 쿠키 저장을 거부하거나 저장된 쿠키를 삭제할 수
            있습니다. 다만 이용권 확인용 쿠키를 삭제하면 결제한 이용권이 인식되지 않을 수 있습니다.
            결제 정보 관련 열람·정정·삭제 요청은 아래 문의처 또는 결제 대행사를 통해 요청할 수
            있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제5조 (개인정보 보호책임자 및 문의처)</h2>
          <p className="mt-2">
            개인정보 처리에 관한 문의·불만·피해구제는 아래로 연락 주시기 바랍니다.
          </p>
          <p className="mt-2">
            상호명: 민트초코자전거 · 대표자 엄형섭
            <br />
            연락처: 010-5965-1609
            <br />
            사업장주소: 경기도 오산시 오산로 190번길 42, 조이상사 2층 230호(원동)
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제6조 (방침의 변경)</h2>
          <p className="mt-2">
            본 개인정보처리방침이 변경되는 경우 시행일과 변경 내용을 서비스 내 공지를 통해 고지합니다.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            관련 약관은{" "}
            <Link href="/terms" className="underline">
              이용약관
            </Link>{" "}
            에서 확인하실 수 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
