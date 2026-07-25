import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const IG_GRAPH = "https://graph.instagram.com"

type CallResult = {
  permission: string
  endpoint: string
  ok: boolean
  status: number
  body: unknown
}

async function call(permission: string, endpoint: string, init?: RequestInit): Promise<CallResult> {
  try {
    const res = await fetch(endpoint, init)
    const body = await res.json().catch(() => ({}))
    return { permission, endpoint: endpoint.replace(/access_token=[^&]+/, "access_token=***"), ok: res.ok, status: res.status, body }
  } catch (e) {
    return { permission, endpoint, ok: false, status: 0, body: { caught: e instanceof Error ? e.message : String(e) } }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
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

  // 2) instagram_business_content_publish — container 만 생성 (publish 안 함)
  const containerCall = await call(
    "instagram_business_content_publish",
    `${IG_GRAPH}/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        image_url: "https://picsum.photos/seed/adflow-verify/1080/1080",
        caption: "AdFlow permission verification — not published",
        access_token: token,
      }),
    },
  )
  results.push(containerCall)

  // 3) instagram_business_manage_messages
  results.push(await call(
    "instagram_business_manage_messages",
    `${IG_GRAPH}/${igUserId}/conversations?platform=instagram&access_token=${token}`,
  ))

  // 4) instagram_business_manage_comments — 미디어 1개 ID 뽑아서 comments 조회
  const mediaList = await fetch(`${IG_GRAPH}/${igUserId}/media?fields=id&limit=1&access_token=${token}`)
  const mediaBody = await mediaList.json().catch(() => ({})) as { data?: Array<{ id: string }>; error?: unknown }
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
      status: mediaList.status,
      body: { note: "미디어가 없거나 조회 실패 — comments 호출 불가", mediaListBody: mediaBody },
    })
  }

  // 토큰에 실제로 포함된 scope 목록
  const permRes = await fetch(`${IG_GRAPH}/me/permissions?access_token=${token}`)
  const permBody = await permRes.json().catch(() => ({})) as {
    data?: Array<{ permission: string; status: string }>
  }
  const grantedScopes = (permBody.data ?? [])
    .filter(p => p.status === "granted")
    .map(p => p.permission)

  const hasPublish = grantedScopes.includes("instagram_business_content_publish")

  const summary = Object.fromEntries(results.map(r => [r.permission, r.ok ? "OK" : `FAIL (${r.status})`]))
  return NextResponse.json({
    ok: results.every(r => r.ok),
    summary,
    results,
    igUserId,
    tokenScopes: {
      granted: grantedScopes,
      hasContentPublish: hasPublish,
    },
  })
}
