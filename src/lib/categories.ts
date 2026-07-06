// 업종 사전 — 카카오 로컬 API 실측(2026-06-30)으로 검증된 키워드/카테고리코드/제외어.
// measurable: true    = 카카오로 깨끗하게 측정됨
//             "proxy" = '무인만' 못 골라내 전체업종 밀도로 대체(정직 표기)
//             false   = 데이터 부족, 결론 보류(준비중)

export type Measurable = true | "proxy" | false;

export interface CategoryDef {
  key: string;
  label: string;
  short: string;
  keywords: string[];
  categoryCode: string | null;
  keepCategory: string[]; // category_name에 이 문자열 포함시만 카운트(매장명 매칭 대신)
  measurable: Measurable;
  note?: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: "studycafe",
    label: "스터디카페",
    short: "스터디카페",
    keywords: ["스터디카페", "스터디룸"],
    categoryCode: null,
    keepCategory: ["스터디카페", "스터디룸"],
    measurable: true,
  },
  {
    key: "laundry",
    label: "코인빨래방",
    short: "코인빨래방",
    keywords: ["코인빨래방", "셀프빨래방", "코인세탁"],
    categoryCode: null,
    keepCategory: ["빨래방"],
    measurable: true,
  },
  {
    key: "photobooth",
    label: "무인사진관",
    short: "무인사진관",
    keywords: ["인생네컷", "무인사진관", "셀프사진관", "즉석사진"],
    categoryCode: null,
    keepCategory: ["즉석사진"], // 일반 사진관/대여스튜디오 제외, 무인 부스만
    measurable: true,
  },
  {
    key: "icecream",
    label: "무인아이스크림",
    short: "아이스크림판매점",
    // 매장명이 '아이스크림스토리' 등이라 '무인아이스크림' 키워드=0.
    // 넓게 '아이스크림' 검색 후 category_name '아이스크림판매'로 필터(배라/커피 제외).
    keywords: ["아이스크림"],
    categoryCode: null,
    keepCategory: ["아이스크림판매"],
    measurable: true,
  },
  {
    key: "convenience",
    label: "편의점(전체)",
    short: "편의점 전체",
    // "무인편의점"=0 항상. CS2 카테고리코드로 편의점 전체 밀도만 측정 가능.
    keywords: [],
    categoryCode: "CS2",
    keepCategory: [],
    measurable: "proxy",
    note: "카카오 데이터에 '무인' 구분이 없어 무인만 골라낼 수 없습니다. 편의점 전체 밀도로 대체 표시합니다.",
  },
  {
    key: "ramen",
    label: "무인라면/밀키트",
    short: "무인라면",
    keywords: ["무인라면", "무인밀키트"],
    categoryCode: null,
    keepCategory: ["분식", "식품판매"],
    measurable: false,
    note: "카카오 POI에 데이터가 거의 없어 신뢰할 수치를 낼 수 없습니다(준비중).",
  },
];

export const CATEGORY_MAP: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);
