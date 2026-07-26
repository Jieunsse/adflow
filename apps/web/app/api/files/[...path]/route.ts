// 버킷 파일의 브라우저 쪽 문. 브라우저는 Spring 주소를 모른다(설계 §3 백엔드 호출 격리).
//
// DB 에는 상대 경로만 살고(product-images/{bp}/{id}.png) 화면이 쓰는 URL 은 이 라우트가 만든다.

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const call = await callBackend(req, `/files/${path.join("/")}`);
  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });

  if (!call.res.ok) {
    return NextResponse.json({ error: "파일을 찾지 못했어요." }, { status: call.res.status });
  }

  return new NextResponse(await call.res.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": call.res.headers.get("content-type") ?? "application/octet-stream",
      // 경로에 항목 id 가 들어가고 덮어쓰기가 같은 경로를 재사용한다 — 길게 캐시하면 안 된다.
      "cache-control": "private, max-age=60",
    },
  });
}
