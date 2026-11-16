import { backendBaseUrl, internalSecret } from "./client";
import type { BackendToken } from "./exchange";

// 무상태 갱신 — 서버가 토큰을 기억하지 않으므로 refresh 토큰만 있으면 된다.
// 실패해도 던지지 않는다. 호출부가 null 을 받고 원래의 401 을 그대로 흘린다.
export async function refreshBackendToken(refreshToken: string): Promise<BackendToken | null> {
  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) return null;

  try {
    const res = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      console.error("[backend] 토큰 갱신 실패", res.status);
      return null;
    }
    return (await res.json()) as BackendToken;
  } catch (e) {
    console.error("[backend] 토큰 갱신 중 오류", e);
    return null;
  }
}
