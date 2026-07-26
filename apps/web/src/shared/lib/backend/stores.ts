// Synced Store 라우트 4개의 공통 프록시. server-side only.
//
// Spring JWT 는 NextAuth 세션 JWT 안에만 있고 브라우저로 내려가지 않는다(설계 §4).
// 그래서 라우트가 getToken() 으로 직접 꺼내 Authorization 헤더에 싣는다.

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isRealOwner } from "@shared/lib/store/ownerKey";
import { backendBaseUrl } from "./client";
import { refreshBackendToken } from "./refresh";

type Handler = (req: NextRequest) => Promise<NextResponse>;

async function call(
  base: string,
  path: string,
  search: string,
  method: string,
  token: string,
  body: string | undefined,
): Promise<Response> {
  return fetch(`${base}${path}${search}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body }),
  });
}

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 게스트·미로그인은 여기 오지 않는다(createSyncedStore 가 단락). 방어적 차단이다.
  if (!jwt || !isRealOwner(jwt.email as string | null | undefined) || !jwt.backendToken) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const base = backendBaseUrl();
  if (!base) {
    // 배포 환경(둘러보기 전용)은 백엔드 URL 을 안 준다 — 설계 §7 의 자동 휴면.
    return NextResponse.json(
      { error: "이 환경에서는 저장 기능을 쓸 수 없어요. 둘러보기 전용이에요." },
      { status: 503 },
    );
  }

  const search = req.nextUrl?.search ?? new URL(req.url).search;
  const body = req.method === "POST" ? await req.text() : undefined;

  let res = await call(base, path, search, req.method, jwt.backendToken as string, body);

  // access 토큰은 1시간이다. 만료되면 한 번만 재발급해 재시도한다.
  if (res.status === 401 && jwt.backendRefreshToken) {
    const issued = await refreshBackendToken(jwt.backendRefreshToken as string);
    if (issued) {
      res = await call(base, path, search, req.method, issued.token, body);
    }
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`[backend] ${req.method} ${path} 실패`, res.status, text.slice(0, 200));
  }
  return new NextResponse(text || null, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export function createStoreRoute(path: string): { GET: Handler; POST: Handler; DELETE: Handler } {
  const handler: Handler = (req) => proxy(req, path);
  return { GET: handler, POST: handler, DELETE: handler };
}
