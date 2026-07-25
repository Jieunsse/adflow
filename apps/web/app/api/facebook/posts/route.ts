import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listPagePosts } from "@/lib/facebook-posts"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const pageOverride = req.nextUrl.searchParams.get("page") ?? undefined
  const cursor = req.nextUrl.searchParams.get("after") ?? undefined
  const pageId = pageOverride || session?.pageId
  const data = await listPagePosts(pageId, session?.accessToken, cursor)
  return NextResponse.json(data)
}
