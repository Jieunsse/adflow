import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramActiveStories, IG_STORIES_MOCK } from "@/lib/instagram-stories"
import { getWorkspaceSession } from "@/lib/meta-session"

export async function GET() {
  const session = await getServerSession(authOptions)
  let workspaceSession
  try {
    workspaceSession = await getWorkspaceSession(session)
  } catch {
    return NextResponse.json({ error: "연결 대상 백엔드를 사용할 수 없어요." }, { status: 503 })
  }
  if (workspaceSession?.browseMode) return NextResponse.json(IG_STORIES_MOCK)

  try {
    const data = await getInstagramActiveStories(
      workspaceSession?.pageId,
      workspaceSession?.accessToken,
      workspaceSession?.igUserId,
      workspaceSession?.igAccessToken,
    )
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "스토리 조회 실패" }, { status: 500 })
  }
}
