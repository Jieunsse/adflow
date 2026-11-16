// 고객 계정 백엔드 호출 (/auth/account/*). server-side only — 내부 시크릿을 싣는다.
// 가입·인증·재설정 화면과 NextAuth 의 이메일 로그인이 같은 통로를 쓴다.

import { backendBaseUrl, internalSecret } from "./client";

export type AccountCall = { ok: boolean; status: number; data: { error?: string } & Record<string, unknown> };

export const ACCOUNT_ACTIONS = ["signup", "verify", "login", "reset-request", "reset", "client-check"] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

export async function callAccount(action: AccountAction, body: unknown): Promise<AccountCall> {
  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) {
    return { ok: false, status: 503, data: { error: "이 환경에서는 고객 로그인을 쓸 수 없어요." } };
  }
  try {
    const res = await fetch(`${base}/auth/account/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as AccountCall["data"];
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 503, data: { error: "서버에 닿지 않았어요. 잠시 뒤 다시 해 주세요." } };
  }
}
