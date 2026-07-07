import crypto from "crypto";

/**
 * 서버 전용 HMAC 서명 토큰 — 두 종류.
 *  1) 엔타이틀먼트(ent): ₩19,900 결제 완료 시 발급. 상세 리포트 API 게이트(미결제 402) +
 *     당일 무제한 진단(쿼터 체크 스킵). 유효기간 = 결제일 당일 자정까지 아님, TTL 방식.
 *  2) 무료 쿼터(quota): 로그인 없는 1일 2회 무료 진단 카운터. 날짜+사용횟수를 HMAC 서명.
 *     시크릿 없으면 위조 가능하므로 시크릿 필수. (쿠키 삭제/시크릿창 우회는 v1 허용 — 한계.)
 * ⚠️ 클라이언트 import 금지 — 서버 route에서만 사용(SECRET 노출 방지).
 */

export const ENT_COOKIE = "mr_ent";
export const QUOTA_COOKIE = "mr_quota";
export const FREE_DAILY_LIMIT = 2;

// Vercel 환경변수 우선, 없으면 fallback(Private 레포 — 카카오 키와 동일 패턴).
// 라이브 전 Vercel에 ENTITLEMENT_SECRET 설정 권장(설정 시 이 fallback 무시).
const SECRET =
  process.env.ENTITLEMENT_SECRET || "mr_ent_9f3b7c1a4e6d2085b1f0a7c3e59d84t2muinradar";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
function hmac(body: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(body).digest());
}
function timingEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ── 엔타이틀먼트(결제) ──────────────────────────────────────────
export interface Entitlement {
  t: "report";
  exp: number; // epoch ms
  oid: string;
}

// 결제 1건 = 14일 이용권(자동갱신 아님). exp/maxAge 모두 14일.
// (기존 발급분 쿠키는 그대로 유효 — 이 상수는 신규 발급 TTL에만 적용됨.)
export const ENT_TTL_DAYS = 14;

/** 서명 토큰 생성. 결제 후 발급(14일 이용권). */
export function signEntitlement(oid: string, ttlDays = ENT_TTL_DAYS): string {
  const payload: Entitlement = { t: "report", exp: Date.now() + ttlDays * 86400_000, oid };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${hmac(body)}`;
}

/** 토큰 검증. 유효+미만료+t==="report"면 Entitlement, 아니면 null. */
export function verifyEntitlement(token: string | undefined | null): Entitlement | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!timingEq(sig, hmac(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Entitlement;
    if (p.t !== "report" || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

// ── 무료 진단 쿼터(1일 N회) ─────────────────────────────────────
export interface Quota {
  date: string; // YYYY-MM-DD (KST)
  used: number;
}

// KST 기준 오늘 날짜(서버가 UTC라도 한국 사용자 하루 경계에 맞춤).
export function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

/** 쿼터 쿠키 서명 토큰 생성. */
export function signQuota(q: Quota): string {
  const body = b64url(Buffer.from(JSON.stringify(q), "utf8"));
  return `${body}.${hmac(body)}`;
}

/** 쿼터 쿠키 검증. 서명 유효하고 오늘 날짜면 그대로, 날짜 다르거나 위조면 오늘 0회로 리셋. */
export function readQuota(token: string | undefined | null): Quota {
  const fresh: Quota = { date: todayKST(), used: 0 };
  if (!token) return fresh;
  const [body, sig] = token.split(".");
  if (!body || !sig || !timingEq(sig, hmac(body))) return fresh;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Quota;
    if (p.date !== todayKST() || typeof p.used !== "number" || p.used < 0) return fresh;
    return { date: p.date, used: Math.floor(p.used) };
  } catch {
    return fresh;
  }
}
