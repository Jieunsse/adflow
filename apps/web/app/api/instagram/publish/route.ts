import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { publishPhoto } from "@/lib/instagram-publish"

export async function POST(req: NextRequest) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  let body: { imageUrl?: string; caption?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청 본문" }, { status: 400 })
  }

  const imageUrl = body.imageUrl?.trim()
  const caption = body.caption?.trim() ?? ""

  if (!imageUrl) return NextResponse.json({ ok: false, error: "imageUrl 이 필요해요." }, { status: 400 })
  if (!/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json({ ok: false, error: "imageUrl 은 http(s) 로 시작하는 공개 URL 이어야 해요." }, { status: 400 })
  }
  if (caption.length > 2200) {
    return NextResponse.json({ ok: false, error: "캡션은 2200자 이하여야 합니다." }, { status: 400 })
  }

  if (session.browseMode) {
    return NextResponse.json({ ok: true, postId: "mock-post", permalink: "https://www.instagram.com/p/mock-post/", mock: true })
  }

  const result = await publishPhoto({
    imageUrl,
    caption,
    igUserId: session.igUserId,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })

  const status = result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status }, { status })
}
