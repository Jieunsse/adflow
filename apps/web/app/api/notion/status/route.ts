import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getNotionConnection } from "@shared/lib/notion-store"

// ADR-043 — 연결 탭 NotionCard 상태 조회.
export async function GET(req: NextRequest) {
  const jwtToken = await getToken({ req })
  const userKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined
  if (!userKey) return NextResponse.json({ connected: false })

  const conn = await getNotionConnection(userKey)
  if (!conn) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    workspaceName: conn.workspaceName ?? null,
    workspaceIcon: conn.workspaceIcon ?? null,
  })
}
