import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { popIgPending } from "@/lib/ig-token-store"

export async function GET(req: NextRequest) {
  const jwtToken = await getToken({ req })
  const storeKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined

  if (!storeKey) return NextResponse.json({ error: "세션이 없어요. 다시 로그인해주세요." }, { status: 401 })

  const pending = popIgPending(storeKey)
  if (pending) return NextResponse.json(pending)

  // OAuth pending 없으면 env 토큰으로 폴백
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!envToken) return NextResponse.json({ error: "No pending connection" }, { status: 404 })

  try {
    const meRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${envToken}`)
    const me = await meRes.json() as { id?: string; username?: string; error?: unknown }
    if (!me.id) return NextResponse.json({ error: "Invalid env token" }, { status: 400 })

    return NextResponse.json({ igAccessToken: envToken, igUserId: me.id, igUsername: me.username ?? "" })
  } catch {
    return NextResponse.json({ error: "Failed to fetch IG profile" }, { status: 500 })
  }
}
