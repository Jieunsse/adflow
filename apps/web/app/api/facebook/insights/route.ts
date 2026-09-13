import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { FB_MOCK_GOOD, getFacebookInsights } from "@/lib/facebook-insights"
import { MetaGraphError } from "@/lib/instagram-graph"

export async function GET(req: NextRequest) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Facebook 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  if (session.browseMode) return NextResponse.json(FB_MOCK_GOOD)
  const pageOverride = req.nextUrl.searchParams.get("page") ?? undefined
  const pageId = pageOverride || session?.pageId
  try {
    const data = await getFacebookInsights(pageId, session.accessToken)
    return NextResponse.json(data)
  } catch (error) {
    const status = error instanceof MetaGraphError && error.status >= 400 ? error.status : 502
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Facebook 인사이트 조회 실패", status }, { status })
  }
}
