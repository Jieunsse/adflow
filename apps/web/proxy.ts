import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { credentialsCache } from "@/lib/meta-credentials"

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // 둘러보기 모드 — 셋업 미완료라도 앱 진입 허용
    const isBrowseMode = token?.browseMode === true

    // 고객은 고객 화면(/portal)만 쓴다 (정책서 5.1). 서버도 직원 API 를 거절하지만 화면에서도 먼저 보낸다.
    // 고객은 광고 계정을 연결하지 않으니 아래 설치·계정 연결 가드를 타지 않는다.
    const isClient = token?.role === "고객"
    const portalPath = pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal")
    const sharedPath = pathname.startsWith("/api/notifications")
    if (isClient) {
      if (portalPath || sharedPath) return NextResponse.next()
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "고객 화면에서만 쓸 수 있어요." }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/portal", req.url))
    }
    if (portalPath) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "고객 화면은 고객만 쓸 수 있어요." }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // 1) Meta 자격증명 미설정 → /install 마법사로 (둘러보기 모드는 예외 — Meta 연동 없이도 데모 체험 가능해야 함)
    const creds = await credentialsCache.get()
    if (!creds && !isBrowseMode) {
      const url = req.nextUrl.clone()
      url.pathname = "/install"
      url.search = ""
      return NextResponse.redirect(url)
    }

    // 광고 계정 + 페이스북 페이지 둘 다 선택돼야 셋업 완료
    const isSetUp = !!token?.adAccountId && !!token?.pageId
    const canEnter = isSetUp || isBrowseMode

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
  matcher: [
    // install/auth/install-api/health, 정적 자원, 폰트, 로그인, 공개 약관 제외 (가드 발동 시 무한 루프 방지)
    // signup·verify-email·reset-password·api/client-auth = 고객 가입과 비밀번호 재설정(로그인 전 화면)
    "/((?!install|api/auth|api/install|api/health|api/client-auth|_next/static|_next/image|favicon.ico|fonts|login|signup|verify-email|reset-password|privacy|terms).*)",
  ],
}
