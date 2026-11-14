import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramReels, IG_REELS_MOCK } from "@/lib/instagram-reels"
import { getWorkspaceSession } from "@/lib/meta-session"

export async function GET() {
  const session = await getServerSession(authOptions)
  let workspaceSession
  try {
    workspaceSession = await getWorkspaceSession(session)
  } catch {
    return NextResponse.json({ error: "연결 대상 백엔드를 사용할 수 없어요." }, { status: 503 })
  }
  if (workspaceSession?.browseMode) return NextResponse.json(IG_REELS_MOCK)

  const hasDirectCreds = !!(workspaceSession?.igAccessToken && workspaceSession?.igUserId)
  const hasPageCreds = !!(workspaceSession?.pageId && workspaceSession?.accessToken)
  if (!hasDirectCreds && !hasPageCreds) {
    return NextResponse.json({ error: "IG 계정이 연결되지 않았어요" }, { status: 400 })
  }

  try {
    const data = await getInstagramReels(
      workspaceSession?.pageId,
      workspaceSession?.accessToken,
      workspaceSession?.igUserId,
      workspaceSession?.igAccessToken,
    )
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "릴스 조회 실패" }, { status: 500 })
  }
}
