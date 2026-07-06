// 쿠팡파트너스 맥락 링크 + 대가성 고지 (참조: cafecost/lib/coupang.ts).
// 마진닥터는 간편링크(link.coupang.com/a/...) 하드코딩 방식이나, 여기선 업종별 검색 상품이
// 다양해 쿠팡 검색결과 파트너스 딥링크(np/search?q=... + lptag=AF코드)로 생성한다.
// lptag = 쿠팡 파트너스 트래킹 파라미터(공개 안전값).

/** 공개 제휴 태그(AF코드) — 코드 삽입 안전한 공개값. */
export const COUPANG_PARTNER_ID = "AF4740209";

/** 검색어로 쿠팡 파트너스 검색 딥링크 생성. href에 파트너스 태그 포함. */
export function coupangSearchLink(query: string): string {
  const q = encodeURIComponent(query);
  return `https://www.coupang.com/np/search?q=${q}&channel=partner&lptag=${COUPANG_PARTNER_ID}`;
}

export interface CoupangItem {
  label: string; // 버튼에 보일 상품 설명
  query: string; // 쿠팡 검색어
}

/** 업종키 → 맥락 상품 링크(2~3개). 결과 카드 하단/결과 맨 아래에 노출. */
export const COUPANG_BY_CATEGORY: Record<string, CoupangItem[]> = {
  studycafe: [
    { label: "키오스크 스탠드", query: "무인 키오스크 스탠드" },
    { label: "멀티탭·콘센트", query: "매장용 멀티탭 콘센트" },
    { label: "좌석 칸막이", query: "스터디카페 좌석 칸막이 파티션" },
  ],
  laundry: [
    { label: "업소용 세탁용품", query: "코인빨래방 세탁세제 업소용" },
    { label: "동전교환기", query: "동전교환기 코인 교환기" },
  ],
  icecream: [
    { label: "업소용 냉동쇼케이스", query: "업소용 냉동 쇼케이스" },
  ],
  photobooth: [
    { label: "포토부스 소품", query: "포토부스 소품 세트" },
  ],
  convenience: [
    { label: "무인계산대", query: "무인 계산대 키오스크" },
    { label: "매장 CCTV", query: "매장용 CCTV 세트" },
  ],
};

/** 선택 업종들에 대한 맥락 링크(중복 제거, 최대 6개). */
export function coupangItemsFor(categoryKeys: string[]): { key: string; item: CoupangItem }[] {
  const out: { key: string; item: CoupangItem }[] = [];
  for (const key of categoryKeys) {
    const items = COUPANG_BY_CATEGORY[key];
    if (!items) continue;
    for (const item of items) {
      out.push({ key, item });
      if (out.length >= 6) return out;
    }
  }
  return out;
}

/** 공정위·쿠팡 필수 대가성 고지 문구 (마진닥터 문구 재사용). */
export const COUPANG_DISCLOSURE =
  "이 서비스는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
