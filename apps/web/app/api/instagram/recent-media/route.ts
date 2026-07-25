import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getRecentMedia, RECENT_MEDIA_MOCK } from "@/lib/instagram-publish"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
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

  return NextResponse.json(result)
}
