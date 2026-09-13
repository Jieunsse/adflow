import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { listComments, createComment, getMockComments } from "@/lib/instagram-comments"

export async function GET(req: NextRequest) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
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
  const status = result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status }, { status })
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
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
  const status = result.ok ? 200 : result.status && result.status >= 400 ? result.status : 502
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error, status }, { status })
}
