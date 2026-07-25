// Meta 앱 자격증명 셋업 API.
//   POST   — 자격증명 저장 + Meta 검증 (app access token + 앱 정보)
//   GET    — 현재 자격증명 상태 + audit log (clientSecret 은 노출 안 함)
//   DELETE — 자격증명 제거 (팀장만)
//
// 권한 규칙:
//   - 자격증명이 아직 없으면 (= 첫 셋업) 누구나 POST 가능 (세션 없을 수 있음)
//   - 자격증명이 이미 있으면 팀장만 교체/삭제 가능

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  setMetaCredentials,
  clearMetaCredentials,
  getMetaCredentials,
  getMetaCredentialsAuditLog,
} from "@/lib/meta-credentials"

const GRAPH = "https://graph.facebook.com/v20.0"

interface MetaError {
  error: { message: string; code: number; type?: string }
}

async function validateWithMeta(
  clientId: string,
  clientSecret: string,
): Promise<{ ok: true; app: { name: string; namespace: string | null } } | { ok: false; message: string }> {
  // 1) client_credentials grant 로 app access token 받기 — 자격증명 자체 유효성 검증
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
  )
  const tokenJson = (await tokenRes.json()) as { access_token?: string } & Partial<MetaError>
  if (!tokenJson.access_token) {
    return {
      ok: false,
      message:
        tokenJson.error?.message ??
        "자격증명이 올바르지 않아요. App ID와 App Secret을 다시 확인해주세요.",
    }
  }
  // 2) 앱 정보 조회 — App ID 가 실제 존재하는지 + 표시용 이름 확보
  const appRes = await fetch(
    `${GRAPH}/${encodeURIComponent(clientId)}?fields=name,namespace&access_token=${tokenJson.access_token}`,
  )
  const appJson = (await appRes.json()) as { name?: string; namespace?: string } & Partial<MetaError>
  if (!appJson.name) {
    return {
      ok: false,
      message: appJson.error?.message ?? "앱 정보를 가져올 수 없어요. App ID가 정확한지 확인해주세요.",
    }
  }
  return { ok: true, app: { name: appJson.name, namespace: appJson.namespace ?? null } }
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | { clientId?: unknown; clientSecret?: unknown }
    | null
  if (
    !body ||
    typeof body.clientId !== "string" ||
    typeof body.clientSecret !== "string" ||
    !body.clientId.trim() ||
    !body.clientSecret.trim()
  ) {
    return NextResponse.json(
      { error: "App ID와 App Secret을 모두 입력해주세요." },
      { status: 400 },
    )
  }

  const clientId = body.clientId.trim()
  const clientSecret = body.clientSecret.trim()

  const session = await getServerSession(authOptions)
  const existing = await getMetaCredentials()
  // 첫 셋업: existing 없음 → 누구나 가능. 교체: 팀장만.
  if (existing && session?.role !== "팀장") {
    return NextResponse.json(
      { error: "팀장만 자격증명을 교체할 수 있어요." },
      { status: 403 },
    )
  }

  const verdict = await validateWithMeta(clientId, clientSecret)
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.message }, { status: 400 })
  }

  const actor = session?.user?.email ?? session?.user?.name ?? "<initial-setup>"
  await setMetaCredentials({ clientId, clientSecret }, actor)

  return NextResponse.json({ ok: true, app: verdict.app })
}

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session) {
    // 첫 셋업 단계에서도 GET 가능 — 마법사가 진행 상태 조회용으로 호출.
    const creds = await getMetaCredentials()
    return NextResponse.json({
      configured: !!creds,
      clientId: creds?.clientId ?? null,
      audit: [],
    })
  }
  const creds = await getMetaCredentials()
  const audit = await getMetaCredentialsAuditLog()
  return NextResponse.json({
    configured: !!creds,
    clientId: creds?.clientId ?? null,
    audit: audit.slice(-10),
  })
}

export async function DELETE(): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
  }
  if (session.role !== "팀장") {
    return NextResponse.json(
      { error: "팀장만 자격증명을 삭제할 수 있어요." },
      { status: 403 },
    )
  }
  const actor = session.user?.email ?? session.user?.name ?? "unknown"
  await clearMetaCredentials(actor)
  return NextResponse.json({ ok: true })
}
