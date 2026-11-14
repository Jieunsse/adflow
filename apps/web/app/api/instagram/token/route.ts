import { NextResponse, type NextRequest } from "next/server"
import { encode, getToken } from "next-auth/jwt"
import { IG_PENDING_COOKIE, openIgPending } from "@/lib/ig-token-store"

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return NextResponse.json({ error: "세션 보안 설정이 없어요." }, { status: 503 })

  const jwtToken = await getToken({ req, secret })
  const storeKey = (jwtToken?.sub ?? jwtToken?.email ?? jwtToken?.jti) as string | undefined

  if (!storeKey) return NextResponse.json({ error: "세션이 없어요. 다시 로그인해주세요." }, { status: 401 })

  const pendingCookie = req.cookies.get(IG_PENDING_COOKIE)?.value
  const pending = pendingCookie ? openIgPending(pendingCookie) : null
  if (pendingCookie && !pending) {
    const res = NextResponse.json({ error: "Instagram 연결 정보가 만료됐어요." }, { status: 404 })
    res.cookies.delete(IG_PENDING_COOKIE)
    return res
  }
  if (pending) {
    if (pending.ownerKey !== storeKey) {
      const res = NextResponse.json({ error: "Instagram 연결 사용자가 달라요." }, { status: 403 })
      res.cookies.delete(IG_PENDING_COOKIE)
      return res
    }
    const res = NextResponse.json({
      igSessionUpdate: await encode({
        token: {
          purpose: "ig-session-update",
          ownerKey: pending.ownerKey,
          igAccessToken: pending.igAccessToken,
          igUserId: pending.igUserId,
          igUsername: pending.igUsername,
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        secret,
        maxAge: 60,
      }),
      igUserId: pending.igUserId,
      igUsername: pending.igUsername,
    })
    res.cookies.delete(IG_PENDING_COOKIE)
    return res
  }

  // 개발자가 명시한 소유자만 로컬 테스트 토큰을 사용할 수 있어요.
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (process.env.NODE_ENV !== "development" || process.env.ADFLOW_DEV_IG_TOKEN_OWNER !== storeKey || !envToken) {
    return NextResponse.json({ error: "Instagram 연결 정보가 없어요." }, { status: 404 })
  }

  try {
    const meRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${envToken}`)
    const me = await meRes.json() as { id?: string; username?: string; error?: unknown }
    if (!meRes.ok || !me.id || !me.username) return NextResponse.json({ error: "개발용 Instagram 토큰이 유효하지 않아요." }, { status: 400 })
    const res = NextResponse.json({
      igSessionUpdate: await encode({
        token: {
          purpose: "ig-session-update",
          ownerKey: storeKey,
          igAccessToken: envToken,
          igUserId: me.id,
          igUsername: me.username,
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        secret,
        maxAge: 60,
      }),
      igUserId: me.id,
      igUsername: me.username,
    })
    return res
  } catch {
    return NextResponse.json({ error: "Instagram 프로필을 확인하지 못했어요." }, { status: 500 })
  }
}
