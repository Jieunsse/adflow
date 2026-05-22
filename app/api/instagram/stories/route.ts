import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramActiveStories } from "@/lib/instagram-stories"

export async function GET() {
  const session = await getServerSession(authOptions)
  const data = await getInstagramActiveStories(
    session?.pageId,
    session?.accessToken,
    session?.igUserId,
    session?.igAccessToken,
  )
  return NextResponse.json(data)
}
