import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { deleteComment, hideComment } from "@/lib/instagram-comments"
import { getWorkspaceSession } from "@/lib/meta-session"

function isMockId(id: string) {
  return id.startsWith("mc") || id.startsWith("mock-")
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  let workspaceSession
  try {
    workspaceSession = await getWorkspaceSession(session)
  } catch {
    return NextResponse.json({ ok: false, error: "연결 대상 백엔드를 사용할 수 없어요." }, { status: 503 })
  }
  if (!workspaceSession) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  if (workspaceSession.browseMode || isMockId(commentId)) return NextResponse.json({ ok: true, mock: true })

  const result = await deleteComment({
    commentId,
    igAccessToken: workspaceSession.igAccessToken,
    pageId: workspaceSession.pageId,
    accessToken: workspaceSession.accessToken,
  })
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status: result.status }, { status: result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502 })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  let workspaceSession
  try {
    workspaceSession = await getWorkspaceSession(session)
  } catch {
    return NextResponse.json({ ok: false, error: "연결 대상 백엔드를 사용할 수 없어요." }, { status: 503 })
  }
  if (!workspaceSession) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  if (workspaceSession.browseMode || isMockId(commentId)) return NextResponse.json({ ok: true, mock: true })

  const { hidden } = await req.json() as { hidden?: boolean }
  const result = await hideComment({
    commentId,
    hidden: !!hidden,
    igAccessToken: workspaceSession.igAccessToken,
    pageId: workspaceSession.pageId,
    accessToken: workspaceSession.accessToken,
  })
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status: result.status }, { status: result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502 })
}
