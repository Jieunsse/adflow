import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { randomBytes } from "crypto"
import { getInstagramRedirectUri, IG_STATE_COOKIE, INSTAGRAM_REQUIRED_SCOPES, sealIgState } from "@/lib/ig-token-store"

const INSTAGRAM_SCOPE = INSTAGRAM_REQUIRED_SCOPES.join(",")

export async function GET(req: NextRequest) {
  const clientId = process.env.INSTAGRAM_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: "Instagram credentials missing" }, { status: 503 })

  const jwtToken = await getToken({ req })
  const ownerKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined
  if (!ownerKey || jwtToken?.browseMode) return NextResponse.json({ error: "Instagram 연결은 로그인 후 이용해주세요." }, { status: 401 })

  const state = randomBytes(16).toString("hex")
  const redirectUri = getInstagramRedirectUri(req)
  const stateCookie = redirectUri && sealIgState({ state, ownerKey, redirectUri })
  if (!redirectUri || !stateCookie) return NextResponse.json({ error: "Instagram OAuth 설정이 올바르지 않아요." }, { status: 503 })

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_SCOPE,
    state,
  })

  const res = NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params}`)
  res.cookies.set(IG_STATE_COOKIE, stateCookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
