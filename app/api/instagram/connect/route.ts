import { NextResponse, type NextRequest } from "next/server"
import { randomBytes } from "crypto"

const SCOPE = "instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages"

export async function GET(req: NextRequest) {
  const clientId = process.env.INSTAGRAM_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: "Instagram credentials missing" }, { status: 503 })

  const state = randomBytes(16).toString("hex")
  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/instagram/callback`

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
  })

  const res = NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params}`)
  res.cookies.set("adflow_ig_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  })
  return res
}
