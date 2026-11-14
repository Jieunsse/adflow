import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { debugInstagramInsights, getInstagramInsights, IG_MOCK_GOOD, type IgInsightsDebug } from "@/lib/instagram-insights"
import { credentialsCache } from "@/lib/meta-credentials"
import { getWorkspaceSession } from "@/lib/meta-session"

const GRAPH = "https://graph.facebook.com/v20.0"

async function introspectToken(userToken: string): Promise<Partial<IgInsightsDebug>> {
  try {
    const creds = await credentialsCache.get()
    if (!creds) return { tokenDebugError: "Meta credentials missing" }
    const appAccessToken = `${creds.clientId}|${creds.clientSecret}`
    const res = await fetch(`${GRAPH}/debug_token?input_token=${userToken}&access_token=${appAccessToken}`)
    const body = await res.json() as {
      data?: { scopes?: string[]; is_valid?: boolean; app_id?: string; user_id?: string; expires_at?: number }
      error?: { message: string }
    }
    return {
      tokenScopes: body.data?.scopes,
      tokenIsValid: body.data?.is_valid,
      tokenAppId: body.data?.app_id,
      tokenUserId: body.data?.user_id,
      tokenExpiresAt: body.data?.expires_at,
      tokenDebugError: body.error?.message,
    }
  } catch (e) {
    return { tokenDebugError: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  let workspaceSession
  try {
    workspaceSession = await getWorkspaceSession(session)
  } catch {
    return NextResponse.json({ error: "연결 대상 백엔드를 사용할 수 없어요." }, { status: 503 })
  }
  if (req.nextUrl.searchParams.get("debug") === "1") {
    const dbg = await debugInstagramInsights(workspaceSession?.pageId, workspaceSession?.accessToken, workspaceSession?.igUserId)
    if (workspaceSession?.accessToken) Object.assign(dbg, await introspectToken(workspaceSession.accessToken))
    return NextResponse.json(dbg)
  }
  if (workspaceSession?.browseMode) return NextResponse.json(IG_MOCK_GOOD)

  try {
    const data = await getInstagramInsights(workspaceSession?.pageId, workspaceSession?.accessToken, workspaceSession?.igUserId, workspaceSession?.igAccessToken)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "insights 조회 실패" }, { status: 500 })
  }
}
