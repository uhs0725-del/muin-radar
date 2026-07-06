"use client";

// 쿠팡파트너스 다이나믹 배너 (캐러셀 300×250, id 1003452).
// 마진닥터(cafecost/components/CoupangBanner.tsx)에서 검증된 패턴 이식:
// g.js는 배너 <ins>를 body 끝에 append하므로, 감지해서 우리 컨테이너로 옮긴다.
// 로드 실패/차단 시 조용히 미노출. 인쇄 시 no-print로 숨김.

import { useEffect, useRef } from "react";

const BANNER_ID = 1003452;
const TRACKING_CODE = "AF4740209";
const BANNER_W = 300;
const BANNER_H = 250;
const SCRIPT_SRC = "https://ads-partners.coupang.com/g.js";

declare global {
  interface Window {
    PartnersCoupang?: {
      G: new (opts: Record<string, unknown>) => unknown;
    };
  }
}

function loadCoupangScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PartnersCoupang) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject());
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

// 모듈 스코프 플래그: StrictMode 이중 마운트/재방문에도 인스턴스는 1회만 생성.
// (ref 가드+cleanup cancel 조합은 dev 이중 마운트에서 생성 자체가 스킵되는 버그가 있었음 — 실측)
let instantiated = false;

export default function CoupangDynamicBanner() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (box.querySelector("ins, iframe")) return; // 이미 렌더됨

    // g.js가 body 끝에 붙이는 <ins>를 감지해 우리 박스로 이동
    const preExisting = new Set(document.querySelectorAll("body > ins"));
    const relocate = (): boolean => {
      // 이미 어딘가(이전 마운트의 박스 포함)에 배너가 있으면 현재 박스로 회수
      const stray = [...document.querySelectorAll("body > ins")].find(
        (n) => !preExisting.has(n),
      );
      const owned = document.querySelector("div[data-coupang-box] ins");
      const ins = stray || (owned && !box.contains(owned) ? owned : null);
      if (ins) {
        box.appendChild(ins);
        return true;
      }
      return !!box.querySelector("ins, iframe");
    };

    let tries = 0;
    let timer: number | undefined;
    const poll = () => {
      if (relocate() || tries > 40) {
        if (timer) window.clearInterval(timer);
        return;
      }
      tries += 1;
    };

    loadCoupangScript()
      .then(() => {
        if (!box.isConnected || !window.PartnersCoupang) return;
        if (!instantiated) {
          instantiated = true;
          try {
            const inline = document.createElement("script");
            inline.text = `new window.PartnersCoupang.G(${JSON.stringify({
              id: BANNER_ID,
              template: "carousel",
              trackingCode: TRACKING_CODE,
              width: String(BANNER_W),
              height: String(BANNER_H),
              tsource: "",
            })});`;
            box.appendChild(inline);
          } catch {
            /* 렌더 실패 — 조용히 미노출 */
          }
        }
        // 인스턴스를 만든 쪽이든 아니든, <ins>를 현재 박스로 회수하는 폴링은 수행
        timer = window.setInterval(poll, 250);
      })
      .catch(() => {
        /* 스크립트 로드 실패(차단 등) — 조용히 미노출 */
      });

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="no-print mt-3 flex justify-center">
      <div
        ref={boxRef}
        data-coupang-box
        aria-label="쿠팡 파트너스 추천 상품 배너"
        style={{ width: BANNER_W, minHeight: 0, maxWidth: "100%", overflow: "hidden" }}
      />
    </div>
  );
}
