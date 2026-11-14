import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import {
  getInstagramRedirectUri,
  IG_PENDING_COOKIE,
  IG_STATE_COOKIE,
  openIgState,
  sealIgPending,
} from "@/lib/ig-token-store"

const IG_GRAPH = "https://graph.instagram.com"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")

  const fail = (reason?: string) => {
    const res = NextResponse.redirect(new URL(`/connect?igError=${encodeURIComponent(reason ?? "1")}`, req.url))
    res.cookies.delete(IG_STATE_COOKIE)
    return res
  }

  if (error || errorReason === "user_denied") return fail("cancelled")

  const storedState = req.cookies.get(IG_STATE_COOKIE)?.value
  const stateData = storedState ? openIgState(storedState) : null
  if (!state || !stateData || state !== stateData.state) return fail("state_mismatch")
  if (!code) return fail()

  const clientId = process.env.INSTAGRAM_CLIENT_ID
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail("no_credentials")

  const redirectUri = getInstagramRedirectUri(req)
  if (!redirectUri || redirectUri !== stateData.redirectUri) return fail("redirect_uri_mismatch")

  // NextAuth 세션에서 사용자 식별자 읽기 (스토어 키로 사용)
  const jwtToken = await getToken({ req })
  const storeKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined
  if (!storeKey || storeKey !== stateData.ownerKey || jwtToken?.browseMode) return fail("no_session")

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
    if (!shortRes.ok || !shortData.access_token) return fail("token_exchange_failed")

    // 장기 토큰 교환 (60일)
    const longUrl = new URL(`${IG_GRAPH}/access_token`)
    longUrl.searchParams.set("grant_type", "ig_exchange_token")
    longUrl.searchParams.set("client_secret", clientSecret)
    longUrl.searchParams.set("access_token", shortData.access_token)
    const longRes = await fetch(longUrl)
    const longData = await longRes.json() as { access_token?: string; expires_in?: number }
    if (!longRes.ok || !longData.access_token || (longData.expires_in !== undefined && longData.expires_in <= 0)) {
      return fail("long_token_exchange_failed")
    }
    const igAccessToken = longData.access_token

    // 사용자 정보
    const meUrl = new URL(`${IG_GRAPH}/me`)
    meUrl.searchParams.set("fields", "id,username")
    meUrl.searchParams.set("access_token", igAccessToken)
    const meRes = await fetch(meUrl)
    const me = await meRes.json() as { id?: string; username?: string }
    if (!meRes.ok || !me.id || !me.username) return fail("invalid_profile")

    const pendingCookie = sealIgPending({
      ownerKey: storeKey,
      igAccessToken,
      igUserId: me.id,
      igUsername: me.username,
    })
    if (!pendingCookie) return fail("no_secret")

    const res = NextResponse.redirect(new URL("/connect?igLinked=1", req.url))
    res.cookies.delete(IG_STATE_COOKIE)
    res.cookies.set(IG_PENDING_COOKIE, pendingCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
      secure: process.env.NODE_ENV === "production",
    })
    return res
  } catch {
    return fail()
  }
}
