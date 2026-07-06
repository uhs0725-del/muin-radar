import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 · 무인업종 상권 포화도 진단",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← 홈으로
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">이용약관</h1>
      <p className="mt-1 text-sm text-slate-400">시행일: 2026년 7월 6일</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-base font-bold text-slate-900">제1조 (목적)</h2>
          <p className="mt-2">
            본 약관은 민트초코자전거(이하 &ldquo;회사&rdquo;)가 제공하는 무인업종 상권 포화도 진단
            서비스(이하 &ldquo;서비스&rdquo;)의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임
            사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제2조 (서비스의 정의)</h2>
          <p className="mt-2">
            서비스는 이용자가 입력한 주소와 업종을 기준으로 공공·지도 데이터를 활용하여 반경 내 경쟁
            매장 밀도를 인구 대비로 환산한 <b>포화도 추정 정보(참고정보)</b>를 제공하는 도구입니다.
            서비스가 제공하는 정보는 통계적 추정치이며, 특정 지역에서의 창업 성공 또는 수익을 보장하지
            않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제3조 (무료 이용 및 유료 이용권)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>회사는 별도 결제 없이 이용 가능한 무료 진단을 1일 2회 제공합니다.</li>
            <li>
              유료 이용권은 <b>₩9,900</b>의 1회 결제로 제공되며, 결제일로부터 <b>30일간</b> 무제한
              진단과 상세 리포트(PDF) 열람 권한을 부여합니다.
            </li>
            <li>
              유료 이용권은 <b>자동갱신되지 않습니다.</b> 30일이 경과하면 이용권은 자동으로 만료되며,
              별도의 자동 청구나 정기 결제는 발생하지 않습니다.
            </li>
            <li>결제는 토스페이먼츠 결제창을 통해 진행됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">
            제4조 (쿠키 기반 이용권 및 이용 환경)
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              본 서비스는 회원가입 및 계정이 없으며, 이용권은 <b>결제한 브라우저의 쿠키</b>로
              확인됩니다.
            </li>
            <li>
              따라서 이용자가 <b>쿠키를 삭제하거나, 다른 브라우저·기기·시크릿(비공개) 모드로 접속하는
              경우</b> 결제한 이용권이 인식되지 않을 수 있습니다.
            </li>
            <li>
              원활한 이용을 위해 <b>결제한 동일 브라우저</b>에서 서비스를 이용하시기 바랍니다. 이용
              환경 변경으로 인한 이용권 미인식에 대해 회사는 별도의 계정 복구 수단을 제공하지 않으나,
              결제 사실이 확인되는 경우 문의처를 통해 지원합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제5조 (데이터 출처 및 면책)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              진단에 사용되는 데이터의 출처는 <b>카카오 로컬(장소 검색) API</b> 및 <b>행정안전부
              주민등록 인구통계</b>입니다.
            </li>
            <li>
              제공되는 결과는 위 공공·지도 데이터를 기반으로 한 <b>참고용 추정치</b>이며, 데이터의
              수집 시점·집계 방식·누락으로 인해 실제 현황과 차이가 있을 수 있습니다. 특히 상업·오피스
              밀집 지역은 유동인구가 반영되지 않아 포화도가 과소·과대평가될 수 있습니다.
            </li>
            <li>
              이용자는 서비스의 진단 결과를 <b>참고 자료로만</b> 활용해야 하며, 창업·투자·임대차 등
              중요한 의사결정은 반드시 이용자 본인의 판단과 현장 실사, 전문가 자문을 통해 이루어져야
              합니다.
            </li>
            <li>
              회사는 진단 결과의 정확성·완전성을 보증하지 않으며, 이용자가 진단 결과에 근거하여 내린
              <b> 창업·투자 결정의 결과(손실 포함)에 대하여 법령이 허용하는 범위 내에서 책임을 지지
              않습니다.</b>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제6조 (환불)</h2>
          <p className="mt-2">
            유료 이용권의 환불은 관련 법령 및 회사의{" "}
            <Link href="/refund" className="font-medium text-slate-900 underline">
              환불규정
            </Link>
            에 따릅니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제7조 (약관의 변경)</h2>
          <p className="mt-2">
            회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 서비스 내
            공지를 통해 시행일과 변경 내용을 고지합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">제8조 (준거법 및 관할)</h2>
          <p className="mt-2">
            본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 회사와 이용자 간에 분쟁이
            발생한 경우 관할은 민사소송법에 따른 법원으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900">문의처</h2>
          <p className="mt-2">
            민트초코자전거 · 대표자 엄형섭 · 연락처 010-5965-1609
            <br />
            사업장주소: 경기도 오산시 오산로 190번길 42, 조이상사 2층 230호(원동)
          </p>
        </section>
      </div>
    </main>
  );
}
