import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  getWorkspaceMetaTarget,
  getWorkspaceMetaTargetAudit,
  updateWorkspaceMetaTarget,
  type WorkspaceMetaTarget,
} from "@/lib/workspace-meta-target"

const keys = ["adAccountId", "adAccountName", "pageId", "pageName", "pixelId", "pixelName", "igUserId", "igUsername"] as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
  if (session.browseMode) return NextResponse.json({ target: {}, lastChange: null })

  try {
    let target = await getWorkspaceMetaTarget()
    if (!target.adAccountId && session.role === "팀장" && session.adAccountId && session.pageId) {
      target = await updateWorkspaceMetaTarget({
        adAccountId: session.adAccountId, adAccountName: session.adAccountName,
        pageId: session.pageId, pageName: session.pageName,
        pixelId: session.pixelId, pixelName: session.pixelName,
        igUserId: session.igUserId, igUsername: session.igUsername,
      }, session.user?.email ?? session.user?.name ?? "팀장")
    }
    const audit = await getWorkspaceMetaTargetAudit()
    return NextResponse.json({ target, lastChange: audit.at(-1) ?? null })
  } catch {
    return NextResponse.json({ error: "연결 대상 저장소를 사용할 수 없어요. 백엔드 설정을 확인해 주세요." }, { status: 503 })
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (session?.role !== "팀장") return NextResponse.json({ error: "팀장만 연결 대상을 변경할 수 있어요." }, { status: 403 })

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid_body")
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "연결 정보 형식이 올바르지 않아요." }, { status: 400 })
  }
  const patch: WorkspaceMetaTarget = {}
  for (const key of keys) {
    if (typeof body[key] === "string") patch[key] = body[key] as never
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "변경할 연결 정보가 없어요." }, { status: 400 })

  try {
    const actor = session.user?.email ?? session.user?.name ?? "팀장"
    const target = await updateWorkspaceMetaTarget(patch, actor)
    return NextResponse.json({ target })
  } catch {
    return NextResponse.json({ error: "연결 대상 저장소를 사용할 수 없어요. 백엔드 설정을 확인해 주세요." }, { status: 503 })
  }
}
