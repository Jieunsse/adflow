import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

const GRAPH = "https://graph.facebook.com/v20.0"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${session.accessToken}`
  )
  const data = (await res.json()) as {
    data?: { id: string; name: string; instagram_business_account?: { id: string; username?: string } }[]
    error?: { message: string }
  }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 502 })
  }

  const pages = (data.data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    igUserId: p.instagram_business_account?.id ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
  }))

  return NextResponse.json({ pages })
}
