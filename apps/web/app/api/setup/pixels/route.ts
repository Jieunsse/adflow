import { NextResponse } from "next/server"
import { withMetaSession } from "@/lib/meta-session"

const GRAPH = "https://graph.facebook.com/v20.0"

export const GET = withMetaSession(["adAccount"], async (_req, s) => {
  const res = await fetch(
    `${GRAPH}/${s.adAccountId}/adspixels?fields=id,name&access_token=${s.accessToken}`
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
