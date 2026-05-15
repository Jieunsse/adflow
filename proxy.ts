import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token
    // 광고 계정 + 페이스북 페이지 둘 다 선택돼야 셋업 완료
    const isSetUp = !!token?.adAccountId && !!token?.pageId
    // 둘러보기 모드 — 셋업 미완료라도 앱 진입 허용
    const canEnter = isSetUp || token?.browseMode === true

    // /api/setup 은 셋업 미완료 상태에서도 허용 (setup 페이지에서 호출)
    if (pathname.startsWith("/api/setup")) return NextResponse.next()

    // 진입 불가(셋업 미완료 + 둘러보기 아님) → /setup 으로
    if (!canEnter && pathname !== "/setup") {
      return NextResponse.redirect(new URL("/setup", req.url))
    }

    // 셋업 완료 → /setup 재방문 시 홈으로
    if (isSetUp && pathname === "/setup") {
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|login|api/auth).*)"],
}
