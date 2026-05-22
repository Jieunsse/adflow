import { NextResponse, type NextRequest } from "next/server"

const GRAPH = "https://graph.facebook.com/v20.0"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")

  const fail = (reason?: string) =>
    NextResponse.redirect(new URL(`/connect?igError=${encodeURIComponent(reason ?? "1")}`, req.url))

  if (error || errorReason === "user_denied") return fail("cancelled")

  const storedState = req.cookies.get("adflow_ig_state")?.value
  if (!state || state !== storedState) return fail("state_mismatch")
  if (!code) return fail()

  const clientId = process.env.INSTAGRAM_CLIENT_ID
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail("no_credentials")

  const redirectUri = `${req.nextUrl.origin}/api/instagram/callback`

  try {
    // 단기 토큰 교환
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    })
    const shortData = await shortRes.json() as { access_token?: string; error_message?: string }
    if (!shortData.access_token) return fail()

    // 장기 토큰 교환 (60일)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortData.access_token}`
    )
    const longData = await longRes.json() as { access_token?: string }
    const igAccessToken = longData.access_token ?? shortData.access_token

    // 사용자 정보
    const meRes = await fetch(`${GRAPH}/me?fields=id,username&access_token=${igAccessToken}`)
    const me = await meRes.json() as { id?: string; username?: string }

    const pending = JSON.stringify({
      igAccessToken,
      igUserId: me.id ?? "",
      igUsername: me.username ?? "",
    })

    const res = NextResponse.redirect(new URL("/connect?igLinked=1", req.url))
    res.cookies.set("adflow_ig_pending", pending, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    })
    res.cookies.delete("adflow_ig_state")
    return res
  } catch {
    return fail()
  }
}
