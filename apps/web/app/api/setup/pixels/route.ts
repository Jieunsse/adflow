import { NextResponse } from "next/server"
import { withMetaSession } from "@/lib/meta-session"

const GRAPH = "https://graph.facebook.com/v20.0"

export const GET = withMetaSession([], async (req, s) => {
  const adAccountId = req.nextUrl.searchParams.get("adAccountId") ?? s.adAccountId
  if (!adAccountId) return NextResponse.json({ error: "광고 계정을 먼저 선택해주세요." }, { status: 400 })
  const res = await fetch(
    `${GRAPH}/${adAccountId}/adspixels?fields=id,name&access_token=${s.accessToken}`
  )
  const data = (await res.json()) as {
    data?: { id: string; name: string }[]
    error?: { message: string }
  }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 502 })
  }

  return NextResponse.json({ pixels: data.data ?? [] })
})
