import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getNotionConnection, getWorkspaceNotionAudit, getWorkspaceNotionOwner } from "@shared/lib/notion-store"

// ADR-043 — 연결 탭 NotionCard 상태 조회.
export async function GET(req: NextRequest) {
  const jwtToken = await getToken({ req })
  if (!jwtToken) return NextResponse.json({ connected: false })

  const owner = await getWorkspaceNotionOwner()
  if (!owner) return NextResponse.json({ connected: false })
  const [conn, audit] = await Promise.all([getNotionConnection(owner), getWorkspaceNotionAudit()])
  if (!conn) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    workspaceName: conn.workspaceName ?? null,
    workspaceIcon: conn.workspaceIcon ?? null,
    lastChange: audit.at(-1) ?? null,
  })
}
