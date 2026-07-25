import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { putIgPending } from "@/lib/ig-token-store"

const IG_GRAPH = "https://graph.instagram.com"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorReason = searchParams.get("error_reason")

  const fail = (reason?: string) => {
    console.error("[IG callback] fail:", reason)
    return NextResponse.redirect(new URL(`/connect?igError=${encodeURIComponent(reason ?? "1")}`, req.url))
  }

  console.log("[IG callback] called. error:", error, "hasCode:", !!code, "hasState:", !!state)

  if (error || errorReason === "user_denied") return fail("cancelled")

  const storedState = req.cookies.get("adflow_ig_state")?.value
  console.log("[IG callback] state match:", state === storedState, "storedState:", !!storedState)
  if (!state || state !== storedState) return fail("state_mismatch")
  if (!code) return fail()

  const clientId = process.env.INSTAGRAM_CLIENT_ID
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail("no_credentials")

  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ?? `${req.nextUrl.origin}/api/instagram/callback`
  console.log("[IG callback] redirectUri:", redirectUri)

  // NextAuth 세션에서 사용자 식별자 읽기 (스토어 키로 사용)
  const jwtToken = await getToken({ req })
  const storeKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined
  console.log("[IG callback] storeKey resolved:", !!storeKey)
  if (!storeKey) return fail("no_session")

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
    if (!shortData.access_token) return fail("token_exchange_failed")

    // 장기 토큰 교환 (60일)
    const longRes = await fetch(
      `${IG_GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortData.access_token}`
    )
    const longData = await longRes.json() as { access_token?: string }
    const igAccessToken = longData.access_token ?? shortData.access_token

    // 사용자 정보
    const meRes = await fetch(`${IG_GRAPH}/me?fields=id,username&access_token=${igAccessToken}`)
    const me = await meRes.json() as { id?: string; username?: string }
    console.log("[IG callback] success. igUserId:", me.id, "username:", me.username)

    putIgPending(storeKey, {
      igAccessToken,
      igUserId: me.id ?? "",
      igUsername: me.username ?? "",
    })

    const res = NextResponse.redirect(new URL("/connect?igLinked=1", req.url))
    res.cookies.delete("adflow_ig_state")
    return res
  } catch (e) {
    console.error("[IG callback] exception:", e)
    return fail()
  }
}
