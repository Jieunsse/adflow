import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

const GRAPH = "https://graph.facebook.com/v20.0"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.adAccountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(
    `${GRAPH}/${session.adAccountId}/adspixels?fields=id,name&access_token=${session.accessToken}`
  )
  const data = (await res.json()) as {
    data?: { id: string; name: string }[]
    error?: { message: string }
  }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 502 })
  }

  return NextResponse.json({ pixels: data.data ?? [] })
}
