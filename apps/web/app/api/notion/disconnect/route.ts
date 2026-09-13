import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { clearWorkspaceNotionOwner, deleteNotionConnection, getWorkspaceNotionOwner } from "@shared/lib/notion-store"

// ADR-043 — Notion 연결 해제. 토큰 행 삭제(IG와 달리 로그아웃 무관).
export async function POST(req: NextRequest) {
  const jwtToken = await getToken({ req })
  if (!jwtToken) return NextResponse.json({ ok: false }, { status: 401 })
  if (jwtToken.role !== "팀장") return NextResponse.json({ error: "팀장만 Notion 연결을 변경할 수 있어요." }, { status: 403 })

  const owner = await getWorkspaceNotionOwner()
  if (owner) await deleteNotionConnection(owner)
  await clearWorkspaceNotionOwner((jwtToken.email ?? jwtToken.name ?? "팀장") as string)
  return NextResponse.json({ ok: true })
}
