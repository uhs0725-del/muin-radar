import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "무인업종 상권 포화도 진단",
  description:
    "주소와 업종을 고르면 반경 내 경쟁 매장 밀도를 인구 대비로 환산해 포화도 신호등으로 알려주는 창업 전 진단 도구.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
