import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { Client } from "@notionhq/client"
import { saveNotionConnection } from "@shared/lib/notion-store"

// ADR-043 — Notion OAuth callback. code → oauth.token() 교환 → Supabase 영속.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const fail = (reason?: string) => {
    console.error("[Notion callback] fail:", reason)
    return NextResponse.redirect(new URL(`/connect?notionError=${encodeURIComponent(reason ?? "1")}`, req.url))
  }

  if (error) return fail("cancelled")

  const storedState = req.cookies.get("adflow_notion_state")?.value
  if (!state || state !== storedState) return fail("state_mismatch")
  if (!code) return fail()

  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail("no_credentials")

  const redirectUri = process.env.NOTION_REDIRECT_URI ?? `${req.nextUrl.origin}/api/notion/callback`

  // 광고 세션(JWT)과 무관하게 user_key 만 식별자로 사용
  const jwtToken = await getToken({ req })
  const userKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined
  if (!userKey) return fail("no_session")

  try {
    const notion = new Client()
    const token = await notion.oauth.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })

    await saveNotionConnection(userKey, {
      accessToken: token.access_token,
      botId: token.bot_id,
      workspaceId: token.workspace_id,
      workspaceName: token.workspace_name ?? undefined,
      workspaceIcon: token.workspace_icon ?? undefined,
    })

    const res = NextResponse.redirect(new URL("/connect?notionLinked=1", req.url))
    res.cookies.delete("adflow_notion_state")
    return res
  } catch (e) {
    console.error("[Notion callback] exception:", e)
    return fail("token_exchange_failed")
  }
}
