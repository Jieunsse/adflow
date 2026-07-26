// 백엔드 호출의 공통 몸통 — 토큰 꺼내기 · 401 시 1회 재발급 재시도. server-side only.
//
// stores.ts 의 proxy 에서 뽑아냈다. 단계 4 의 파일·제품 라우트는 JSON 이 아닌 바디를 보내거나
// 한 요청에서 백엔드를 두 번 불러야 해서(파일 PUT → 항목 POST) 공유가 필요했다.
//
// Spring JWT 는 NextAuth 세션 JWT 안에만 있고 브라우저로 내려가지 않는다(설계 §4).

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { isRealOwner } from "@shared/lib/store/ownerKey";
import { backendBaseUrl } from "./client";
import { refreshBackendToken } from "./refresh";

export type BackendCall =
  | { ok: true; res: Response }
  | { ok: false; status: 401 | 503; message: string };

export interface BackendInit {
  method?: string;
  body?: BodyInit;
  contentType?: string;
}

export async function callBackend(
  req: NextRequest,
  path: string,
  init: BackendInit = {},
): Promise<BackendCall> {
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 게스트·미로그인은 여기 오지 않는다(클라 훅이 단락). 방어적 차단이다.
  if (!jwt || !isRealOwner(jwt.email as string | null | undefined) || !jwt.backendToken) {
    return { ok: false, status: 401, message: "로그인이 필요해요." };
  }

  const base = backendBaseUrl();
  if (!base) {
    // 배포 환경(둘러보기 전용)은 백엔드 URL 을 안 준다 — 설계 §7 의 자동 휴면.
    return {
      ok: false,
      status: 503,
      message: "이 환경에서는 저장 기능을 쓸 수 없어요. 둘러보기 전용이에요.",
    };
  }

  const send = (token: string) =>
    fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      },
      ...(init.body === undefined ? {} : { body: init.body }),
    });

  let res = await send(jwt.backendToken as string);

  // access 토큰은 1시간이다. 만료되면 한 번만 재발급해 재시도한다.
  if (res.status === 401 && jwt.backendRefreshToken) {
    const issued = await refreshBackendToken(jwt.backendRefreshToken as string);
    if (issued) res = await send(issued.token);
  }

  return { ok: true, res };
}
