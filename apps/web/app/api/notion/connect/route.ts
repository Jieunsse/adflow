import { NextResponse, type NextRequest } from "next/server"
import { randomBytes } from "crypto"

// ADR-043 — Notion OAuth(public integration) 시작. IG connect 패턴과 동일.
export async function GET(req: NextRequest) {
  const clientId = process.env.NOTION_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: "Notion credentials missing" }, { status: 503 })

  const state = randomBytes(16).toString("hex")
  const redirectUri = process.env.NOTION_REDIRECT_URI ?? `${req.nextUrl.origin}/api/notion/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
    state,
  })

  const res = NextResponse.redirect(`https://api.notion.com/v1/oauth/authorize?${params}`)
  res.cookies.set("adflow_notion_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  })
  return res
}
