import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramThread } from "@/lib/instagram-messages"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await getServerSession(authOptions)
  const data = await getInstagramThread(id, session?.pageId, session?.accessToken, session?.igUserId)
  return NextResponse.json(data)
}
