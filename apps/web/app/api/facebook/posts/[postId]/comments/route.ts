import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { FB_COMMENTS_MOCK, listPostComments } from "@/lib/facebook-posts"
import { MetaGraphError } from "@/lib/instagram-graph"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Facebook 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  if (session.browseMode) return NextResponse.json({ comments: FB_COMMENTS_MOCK, mock: true })
  const pageOverride = req.nextUrl.searchParams.get("page") ?? undefined
  const pageId = pageOverride || session?.pageId
  const { postId } = await params
  try {
    return NextResponse.json(await listPostComments(postId, pageId, session.accessToken))
  } catch (error) {
    const status = error instanceof MetaGraphError && error.status >= 400 ? error.status : 502
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Facebook 댓글 조회 실패", status }, { status })
  }
}
