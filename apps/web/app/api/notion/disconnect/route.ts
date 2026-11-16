import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { deleteNotionConnection } from "@shared/lib/notion-store"

// ADR-043 — Notion 연결 해제. 토큰 행 삭제(IG와 달리 로그아웃 무관).
export async function POST(req: NextRequest) {
  const jwtToken = await getToken({ req })
  const userKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined
  if (!userKey) return NextResponse.json({ ok: false }, { status: 401 })

  await deleteNotionConnection(userKey)
  return NextResponse.json({ ok: true })
}
