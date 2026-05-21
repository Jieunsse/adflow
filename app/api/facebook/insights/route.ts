import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getFacebookInsights } from "@/lib/facebook-insights"

export async function GET() {
  const session = await getServerSession(authOptions)
  const data = await getFacebookInsights(session?.pageId, session?.accessToken)
  return NextResponse.json(data)
}
