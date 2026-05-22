import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { publishPhoto } from "@/lib/instagram-publish"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
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

  const result = await publishPhoto({
    imageUrl,
    caption,
    igUserId: session.igUserId,
    igAccessToken: session.igAccessToken,
    pageId: session.pageId,
    accessToken: session.accessToken,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
