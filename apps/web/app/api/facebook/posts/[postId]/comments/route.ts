import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listPostComments } from "@/lib/facebook-posts"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getServerSession(authOptions)
  const pageOverride = req.nextUrl.searchParams.get("page") ?? undefined
  const pageId = pageOverride || session?.pageId
  const { postId } = await params
  const data = await listPostComments(postId, pageId, session?.accessToken)
  return NextResponse.json(data)
}
