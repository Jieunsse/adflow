import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramInsights } from "@/lib/instagram-insights"

export async function GET() {
  const session = await getServerSession(authOptions)
  const data = await getInstagramInsights(session?.pageId, session?.accessToken, session?.igUserId)
  return NextResponse.json(data)
}
