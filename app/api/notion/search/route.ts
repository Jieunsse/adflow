import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getNotionConnection } from "@shared/lib/notion-store"
import { searchSharedResources } from "@/lib/notion"

// ADR-043 — import 자원 선택 모달용. 공유된 page·data_source 목록.
export async function GET(req: NextRequest) {
  const jwt = await getToken({ req })
  const userKey = (jwt?.sub ?? jwt?.email ?? jwt?.jti) as string | undefined
  if (!userKey) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const conn = await getNotionConnection(userKey)
  if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 403 })

  try {
    const resources = await searchSharedResources(conn.accessToken)
    return NextResponse.json({ resources })
  } catch (e) {
    console.error("[Notion search] failed:", e)
    return NextResponse.json({ error: "notion_failed" }, { status: 502 })
  }
}
