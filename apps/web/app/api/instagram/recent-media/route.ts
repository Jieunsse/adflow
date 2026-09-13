import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { getRecentMedia, RECENT_MEDIA_MOCK } from "@/lib/instagram-publish"

export async function GET(req: NextRequest) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  const limitParam = req.nextUrl.searchParams.get("limit")
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 5, 50) : 5

  if (session.browseMode) return NextResponse.json({ ok: true, items: RECENT_MEDIA_MOCK, mock: true })

  const result = await getRecentMedia({
    igUserId: session.igUserId,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
    limit,
  })

  const status = result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status }, { status })
}
