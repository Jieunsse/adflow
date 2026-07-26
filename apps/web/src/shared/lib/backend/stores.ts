// Synced Store 라우트의 공통 프록시. server-side only.
//
// 토큰 꺼내기·401 재시도는 call.ts 의 callBackend 가 한다(단계 4 에서 파일 라우트와 공유하려고
// 뽑아냈다). 여기 남은 것은 "응답을 그대로 흘려보낸다" 는 프록시 성격뿐이다.

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "./call";

type Handler = (req: NextRequest) => Promise<NextResponse>;

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const search = req.nextUrl?.search ?? new URL(req.url).search;
  const body = req.method === "POST" ? await req.text() : undefined;

  const call = await callBackend(req, `${path}${search}`, {
    method: req.method,
    ...(body === undefined ? {} : { body, contentType: "application/json" }),
  });

  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });

  const text = await call.res.text();
  if (!call.res.ok) {
    console.error(`[backend] ${req.method} ${path} 실패`, call.res.status, text.slice(0, 200));
  }
  return new NextResponse(text || null, {
    status: call.res.status,
    headers: { "content-type": call.res.headers.get("content-type") ?? "application/json" },
  });
}

export function createStoreRoute(path: string): { GET: Handler; POST: Handler; DELETE: Handler } {
  const handler: Handler = (req) => proxy(req, path);
  return { GET: handler, POST: handler, DELETE: handler };
}
