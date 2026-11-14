import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { getInstagramInbox, IG_INBOX_MOCK } from "@/lib/instagram-messages"
import { MetaGraphError } from "@/lib/instagram-graph"

export async function GET() {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  if (session.browseMode) return NextResponse.json(IG_INBOX_MOCK)
  try {
    const data = await getInstagramInbox(
      session.pageId,
      session.accessToken,
      session.igUserId,
      session.igAccessToken,
    )
    return NextResponse.json(data)
  } catch (error) {
    const status = error instanceof MetaGraphError && error.status >= 400 ? error.status : 502
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Instagram 대화 조회 실패", status }, { status })
  }
}
