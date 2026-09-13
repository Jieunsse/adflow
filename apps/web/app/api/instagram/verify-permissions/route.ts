import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { graphErrorMessage, hasGraphError, readGraphBody } from "@/lib/instagram-graph"

const IG_GRAPH = "https://graph.instagram.com"

type CallResult = {
  permission: string
  endpoint: string
  ok: boolean
  status: number
  body: unknown
}

function publicResult({ body, ...result }: CallResult): Omit<CallResult, "body"> & { message?: string } {
  const message = graphErrorMessage(body, "")
  return message ? { ...result, message } : result
}

async function call(permission: string, endpoint: string, init?: RequestInit): Promise<CallResult> {
  const safeEndpoint = endpoint.replace(/access_token=[^&]+/, "access_token=***")
  try {
    const res = await fetch(endpoint, { ...init, cache: "no-store" })
    const body = await readGraphBody(res)
    const graphError = hasGraphError(body)
    return { permission, endpoint: safeEndpoint, ok: res.ok && !graphError, status: graphError && res.status < 400 ? 502 : res.status, body }
  } catch (e) {
    return { permission, endpoint: safeEndpoint, ok: false, status: 0, body: { caught: e instanceof Error ? e.message : String(e) } }
  }
}

export async function GET() {
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  const token = session?.igAccessToken
  const igUserId = session?.igUserId

  if (!token || !igUserId) {
    return NextResponse.json({
      ok: false,
      error: "session 에 igAccessToken / igUserId 없음. /connect 에서 IG 비즈니스 로그인 먼저.",
      hasSession: !!session,
      hasToken: !!token,
      hasIgUserId: !!igUserId,
    }, { status: 400 })
  }

  const results: CallResult[] = []

  // 1) instagram_business_manage_insights
  results.push(await call(
    "instagram_business_manage_insights",
    `${IG_GRAPH}/${igUserId}/insights?metric=reach&period=days_28&access_token=${token}`,
  ))

  // 2) instagram_business_manage_messages
  results.push(await call(
    "instagram_business_manage_messages",
    `${IG_GRAPH}/${igUserId}/conversations?platform=instagram&access_token=${token}`,
  ))

  // 3) instagram_business_manage_comments — 미디어 1개 ID 뽑아서 comments 조회
  const mediaCall = await call(
    "instagram_media_read",
    `${IG_GRAPH}/${igUserId}/media?fields=id&limit=1&access_token=${token}`,
  )
  const rawMediaBody = mediaCall.body
  const mediaBody = typeof rawMediaBody === "object" && rawMediaBody !== null ? rawMediaBody as { data?: Array<{ id: string }>; error?: { message?: string } } : {}
  const mediaId = mediaBody.data?.[0]?.id
  if (mediaId) {
    results.push(await call(
      "instagram_business_manage_comments",
      `${IG_GRAPH}/${mediaId}/comments?access_token=${token}`,
    ))
  } else {
    results.push({
      permission: "instagram_business_manage_comments",
      endpoint: `${IG_GRAPH}/${igUserId}/media?limit=1`,
      ok: false,
      status: mediaCall.status,
      body: { note: "미디어가 없거나 조회 실패 — comments 호출 불가", mediaListBody: rawMediaBody },
    })
  }

  // 토큰에 실제로 포함된 scope 목록. 권한 검증은 읽기 전용이며 media container를 만들지 않는다.
  const permissionCall = await call(
    "instagram_permissions",
    `${IG_GRAPH}/me/permissions?access_token=${token}`,
  )
  const rawPermBody = permissionCall.body
  const permBody = typeof rawPermBody === "object" && rawPermBody !== null ? rawPermBody as {
    data?: Array<{ permission: string; status: string }>
    error?: { message?: string }
  } : {}
  const grantedScopes = (permBody.data ?? [])
    .filter(p => p.status === "granted")
    .map(p => p.permission)

  const hasPublish = grantedScopes.includes("instagram_business_content_publish")
  results.push({
    permission: "instagram_business_content_publish",
    endpoint: `${IG_GRAPH}/me/permissions?access_token=***`,
    ok: permissionCall.ok && hasPublish,
    status: permissionCall.status,
    body: permissionCall.ok && hasPublish ? rawPermBody : { error: graphErrorMessage(permBody, "content publish 권한이 없어요."), permissions: rawPermBody },
  })

  const summary = Object.fromEntries(results.map(r => [r.permission, r.ok ? "OK" : `FAIL (${r.status})`]))
  return NextResponse.json({
    ok: results.every(r => r.ok),
    summary,
    results: results.map(publicResult),
    igUserId,
    tokenScopes: {
      granted: grantedScopes,
      hasContentPublish: hasPublish,
    },
  })
}
