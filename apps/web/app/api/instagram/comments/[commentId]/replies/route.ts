import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listReplies, replyToComment, getMockReplies } from "@/lib/instagram-comments"

function isMockId(id: string) {
  return id.startsWith("mc") || id.startsWith("mock-")
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  if (session.browseMode || isMockId(commentId)) return NextResponse.json({ ok: true, items: getMockReplies(commentId), mock: true })

  const result = await listReplies({
    commentId,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })
  return NextResponse.json(result)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  if (session.browseMode || isMockId(commentId)) return NextResponse.json({ ok: true, id: `mock-reply-${Date.now()}`, mock: true })

  const { message } = await req.json() as { message?: string }
  if (!message?.trim()) {
    return NextResponse.json({ ok: false, error: "message 가 필요합니다." }, { status: 400 })
  }

  const result = await replyToComment({
    commentId,
    message: message.trim(),
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })
  return NextResponse.json(result)
}
