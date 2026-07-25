import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const IG_GRAPH = "https://graph.instagram.com"
const FB_GRAPH = "https://graph.facebook.com/v20.0"

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  const token = session?.igAccessToken
  const igUserId = session?.igUserId

  if (!token || !igUserId) {
    return NextResponse.json({ ok: false, error: "세션에 igAccessToken / igUserId 없음" }, { status: 400 })
  }

  const mediaId = req.nextUrl.searchParams.get("mediaId") ?? ""

  const results: Record<string, unknown> = {}

  // 1) 토큰이 누구 것인지 확인
  const meRes = await fetch(`${IG_GRAPH}/me?fields=id,username&access_token=${token}`)
  results.me = { status: meRes.status, body: await meRes.json().catch(() => ({})) }

  // 2) graph.instagram.com/me/permissions (IGAAX 토큰에서 작동 안 할 수 있음)
  const igPermRes = await fetch(`${IG_GRAPH}/me/permissions?access_token=${token}`)
  results.igPermissions = { status: igPermRes.status, body: await igPermRes.json().catch(() => ({})) }

  // 3) Facebook token debug (scopes 확인) — app token 없이 input_token만으로도 일부 정보 노출
  const fbDebugRes = await fetch(
    `${FB_GRAPH}/debug_token?input_token=${token}&access_token=${token}`
  )
  results.fbTokenDebug = { status: fbDebugRes.status, body: await fbDebugRes.json().catch(() => ({})) }

  if (mediaId) {
    // 4) 기본 호출 (fields 없음)
    const c1 = await fetch(`${IG_GRAPH}/${mediaId}/comments?access_token=${token}`)
    results.commentsNoFields = { status: c1.status, body: await c1.json().catch(() => ({})) }

    // 5) hidden 제외한 fields
    const c2 = await fetch(
      `${IG_GRAPH}/${mediaId}/comments?fields=id,username,text,timestamp,like_count&access_token=${token}`
    )
    results.commentsWithoutHidden = { status: c2.status, body: await c2.json().catch(() => ({})) }

    // 6) hidden 포함 (현재 코드와 동일)
    const c3 = await fetch(
      `${IG_GRAPH}/${mediaId}/comments?fields=id,username,text,timestamp,like_count,hidden,replies.summary(true)&limit=100&access_token=${token}`
    )
    results.commentsWithHidden = { status: c3.status, body: await c3.json().catch(() => ({})) }

    // 7) media 소유권 확인
    const mediaOwner = await fetch(
      `${IG_GRAPH}/${mediaId}?fields=id,owner,username&access_token=${token}`
    )
    results.mediaOwner = { status: mediaOwner.status, body: await mediaOwner.json().catch(() => ({})) }
  }

  return NextResponse.json({ igUserId, mediaId, results })
}
