import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { debugInstagramInsights, getInstagramInsights, type IgInsightsDebug } from "@/lib/instagram-insights"
import { credentialsCache } from "@/lib/meta-credentials"

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
  if (req.nextUrl.searchParams.get("debug") === "1") {
    const dbg = await debugInstagramInsights(session?.pageId, session?.accessToken, session?.igUserId)
    if (session?.accessToken) Object.assign(dbg, await introspectToken(session.accessToken))
    return NextResponse.json(dbg)
  }
  const data = await getInstagramInsights(session?.pageId, session?.accessToken, session?.igUserId)
  return NextResponse.json(data)
}
