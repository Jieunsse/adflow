import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramActiveStories, IG_STORIES_MOCK } from "@/lib/instagram-stories"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.browseMode) return NextResponse.json(IG_STORIES_MOCK)

  try {
    const data = await getInstagramActiveStories(
      session?.pageId,
      session?.accessToken,
      session?.igUserId,
      session?.igAccessToken,
    )
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "스토리 조회 실패" }, { status: 500 })
  }
}
