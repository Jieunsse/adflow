import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { deleteComment, hideComment } from "@/lib/instagram-comments"

function isMockId(id: string) {
  return id.startsWith("mc") || id.startsWith("mock-")
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  if (session.browseMode || isMockId(commentId)) return NextResponse.json({ ok: true, mock: true })

  const result = await deleteComment({
    commentId,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  if (session.browseMode || isMockId(commentId)) return NextResponse.json({ ok: true, mock: true })

  const { hidden } = await req.json() as { hidden?: boolean }
  const result = await hideComment({
    commentId,
    hidden: !!hidden,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })
  return NextResponse.json(result)
}
