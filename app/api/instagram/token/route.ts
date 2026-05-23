import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { popIgPending } from "@/lib/ig-token-store"

export async function GET(req: NextRequest) {
  const jwtToken = await getToken({ req })
  const storeKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined

  if (!storeKey) return NextResponse.json({ error: "세션이 없어요. 다시 로그인해주세요." }, { status: 401 })

  const data = popIgPending(storeKey)
  if (!data) return NextResponse.json({ error: "No pending connection" }, { status: 404 })

  return NextResponse.json(data)
}
