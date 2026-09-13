import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { credentialsCache } from "@/lib/meta-credentials"
import { getWorkspaceSession } from "@/lib/meta-session"
import type { Session } from "next-auth"

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token
    const isSetupBootstrapPath = new Set([
      "/connect",
      "/api/workspace/meta-target",
      "/api/instagram/connect",
      "/api/instagram/callback",
      "/api/instagram/token",
    ]).has(pathname)
    const isSetupPath = isSetupBootstrapPath || pathname.startsWith("/api/setup")
    let workspaceSession: Session | null = token
      ? {
          expires: "",
          user: { name: token.name, email: token.email, image: token.picture },
          accessToken: token.accessToken,
          adAccountId: token.adAccountId,
          adAccountName: token.adAccountName,
          pageId: token.pageId,
          pageName: token.pageName,
          pixelId: token.pixelId,
          pixelName: token.pixelName,
          igUserId: token.igUserId,
          igUsername: token.igUsername,
          igAccessToken: token.igAccessToken,
          browseMode: token.browseMode,
          role: token.role,
        } as Session
      : null

    // 둘러보기 모드 — 셋업 미완료라도 앱 진입 허용
    const isBrowseMode = token?.browseMode === true

    // 1) Meta 자격증명 미설정 → /install 마법사로 (둘러보기 모드는 예외 — Meta 연동 없이도 데모 체험 가능해야 함)
    const creds = await credentialsCache.get()
    if (!creds && !isBrowseMode && !isSetupPath) {
      const url = req.nextUrl.clone()
      url.pathname = "/install"
      url.search = ""
      return NextResponse.redirect(url)
    }

    let resolvedWorkspaceSession = workspaceSession
    if (!isSetupPath) {
      try {
        resolvedWorkspaceSession = await getWorkspaceSession(workspaceSession)
      } catch {
        return NextResponse.json({ error: "연결 대상 백엔드를 사용할 수 없어요." }, { status: 503 })
      }
    }

    // 광고 계정 + 페이스북 페이지 둘 다 선택돼야 셋업 완료
    const isSetUp = !!resolvedWorkspaceSession?.adAccountId && !!resolvedWorkspaceSession?.pageId
    const canEnter = isSetUp || isBrowseMode

    // /api/setup 은 셋업 미완료 상태에서도 허용 (setup 페이지에서 호출)
    if (pathname.startsWith("/api/setup")) return NextResponse.next()

    // 진입 불가(셋업 미완료 + 둘러보기 아님) → /setup 으로
    if (!canEnter && pathname !== "/setup" && !isSetupPath) {
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
    "/((?!install|api/auth|api/install|api/health|api/instagram/webhook$|_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|fonts|login|privacy|terms).*)",
  ],
}
