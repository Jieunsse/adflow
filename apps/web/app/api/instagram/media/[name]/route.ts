// 인스타그램 게시용 파일을 Spring 미디어 저장소로 넘긴다. 로그인한 직원의 토큰으로 올린다 (/media).

import { NextResponse, type NextRequest } from "next/server"
import { callBackend } from "@shared/lib/backend/call"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PUT(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params
  const call = await callBackend(req, `/media/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: await req.arrayBuffer(),
    contentType: req.headers.get("content-type") ?? "application/octet-stream",
  })
  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status })
  const text = await call.res.text()
  return new NextResponse(text || null, {
    status: call.res.status,
    headers: { "content-type": call.res.headers.get("content-type") ?? "application/json" },
  })
}
