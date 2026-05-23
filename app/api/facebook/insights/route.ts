import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getFacebookInsights } from "@/lib/facebook-insights"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const pageOverride = req.nextUrl.searchParams.get("page") ?? undefined
  const pageId = pageOverride || session?.pageId
  const data = await getFacebookInsights(pageId, session?.accessToken)
  return NextResponse.json(data)
}
