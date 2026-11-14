import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { publishReel } from "@/lib/instagram-reels-publish"

export async function POST(req: NextRequest) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  let body: { videoUrl?: string; caption?: string; coverUrl?: string; shareToFeed?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청 본문" }, { status: 400 })
  }

  const videoUrl = body.videoUrl?.trim()
  const caption = body.caption?.trim() ?? ""

  if (!videoUrl) return NextResponse.json({ ok: false, error: "videoUrl 이 필요해요." }, { status: 400 })
  if (!caption) return NextResponse.json({ ok: false, error: "caption 이 필요해요." }, { status: 400 })
  if (!/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ ok: false, error: "videoUrl 은 http(s) 로 시작하는 공개 URL 이어야 해요." }, { status: 400 })
  }
  if (caption.length > 2200) {
    return NextResponse.json({ ok: false, error: "캡션은 2200자 이하여야 합니다." }, { status: 400 })
  }

  if (session.browseMode) {
    return NextResponse.json({ ok: true, mediaId: "mock-reel", permalink: null, mock: true })
  }

  const result = await publishReel(
    {
      igUserId: session.igUserId,
      igAccessToken: session.igAccessToken,
      pageId: session.pageId,
      accessToken: session.accessToken,
    },
    {
      videoUrl,
      caption,
      coverUrl: body.coverUrl?.trim() || undefined,
      shareToFeed: body.shareToFeed ?? true,
    }
  )

  const status = result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status }, { status })
}
