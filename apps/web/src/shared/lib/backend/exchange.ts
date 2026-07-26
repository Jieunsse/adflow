import { GUEST_OWNER, isRealOwner } from "@shared/lib/store/ownerKey";
import { backendBaseUrl, internalSecret } from "./client";

export type ExchangeInput = {
  ownerKey: string;
  email: string;
  role?: string;
  metaConnection?: Record<string, string | undefined>;
};

export type BackendToken = {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

// 로그인 직후 1회. 실패해도 로그인을 깨지 않는다 — 단계 1 시점에 프론트 데이터는
// 백엔드 토큰이 없어도(백엔드 미설정 환경) 로그인 자체는 깨지지 않는다.
export async function exchangeForBackendToken(
  input: ExchangeInput,
): Promise<BackendToken | null> {
  if (!isRealOwner(input.ownerKey) || input.email === GUEST_OWNER) return null;

  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) return null;

  try {
    const res = await fetch(`${base}/auth/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("[backend] 토큰 교환 실패", res.status);
      return null;
    }
    return (await res.json()) as BackendToken;
  } catch (e) {
    console.error("[backend] 토큰 교환 중 오류", e);
    return null;
  }
}
