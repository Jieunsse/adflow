import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramReels, IG_REELS_MOCK } from "@/lib/instagram-reels"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.browseMode) return NextResponse.json(IG_REELS_MOCK)

  const hasDirectCreds = !!(session?.igAccessToken && session?.igUserId)
  const hasPageCreds = !!(session?.pageId && session?.accessToken)
  if (!hasDirectCreds && !hasPageCreds) {
    return NextResponse.json({ error: "IG 계정이 연결되지 않았어요" }, { status: 400 })
  }

  try {
    const data = await getInstagramReels(
      session?.pageId,
      session?.accessToken,
      session?.igUserId,
      session?.igAccessToken,
    )
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "릴스 조회 실패" }, { status: 500 })
  }
}
