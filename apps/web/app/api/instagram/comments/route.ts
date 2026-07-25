import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listComments, createComment, getMockComments } from "@/lib/instagram-comments"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  const mediaId = req.nextUrl.searchParams.get("mediaId")?.trim()
  if (!mediaId) return NextResponse.json({ ok: false, error: "mediaId 가 필요합니다." }, { status: 400 })

  if (session.browseMode) return NextResponse.json({ ok: true, items: getMockComments(mediaId), mock: true })

  const result = await listComments({
    mediaId,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })
  if (!result.ok || (result.ok && result.items.length === 0)) {
    console.log("[comments] mediaId=%s result=%s", mediaId, JSON.stringify(result))
  }
  // App Review 미제출 상태에서 API가 data:[] 를 반환하는 경우 개발 환경에서만 mock 폴백
  if (result.ok && result.items.length === 0 && process.env.NODE_ENV === "development") {
    return NextResponse.json({ ok: true, items: getMockComments(mediaId), mock: true, devFallback: true })
  }
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  const { mediaId, message } = await req.json() as { mediaId?: string; message?: string }
  if (!mediaId || !message?.trim()) {
    return NextResponse.json({ ok: false, error: "mediaId 와 message 가 필요합니다." }, { status: 400 })
  }

  if (session.browseMode) return NextResponse.json({ ok: true, id: `mock-${Date.now()}`, mock: true })

  const result = await createComment({
    mediaId,
    message: message.trim(),
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })
  return NextResponse.json(result)
}
