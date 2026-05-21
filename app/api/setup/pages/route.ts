import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

const GRAPH = "https://graph.facebook.com/v20.0"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // PRD §13 — leads_call goal 사전 검증용 phone 필드 추가.
  // phone 없는 페이지는 전화 받기 광고 실제 게재 불가 — STEP 02 에서 warn callout.
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,phone,instagram_business_account{id,username}&access_token=${session.accessToken}`
  )
  const data = (await res.json()) as {
    data?: { id: string; name: string; phone?: string; instagram_business_account?: { id: string; username?: string } }[]
    error?: { message: string }
  }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 502 })
  }

  const pages = (data.data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    phone: p.phone ?? null,
    igUserId: p.instagram_business_account?.id ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
  }))

  return NextResponse.json({ pages })
}
