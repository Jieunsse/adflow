import type { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import FacebookProvider from "next-auth/providers/facebook"
import { decode } from "next-auth/jwt"
import { credentialsCache, type MetaCredentials } from "./meta-credentials"
import { exchangeForBackendToken } from "@shared/lib/backend/exchange"

type Providers = NonNullable<AuthOptions["providers"]>

const GRAPH = "https://graph.facebook.com/v20.0"
const SCOPE =
  "public_profile,email,ads_management,ads_read,pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_manage_insights"

// Exchanges the short-lived (1-2h) login token for a 60-day long-lived token.
// Falls back to the short-lived token on failure — works for now but expires soon.
async function exchangeForLongLivedToken(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  try {
    const url = new URL(`${GRAPH}/oauth/access_token`)
    url.searchParams.set("grant_type", "fb_exchange_token")
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("client_secret", clientSecret)
    url.searchParams.set("fb_exchange_token", shortLivedToken)
    const res = await fetch(url)
    const data = (await res.json()) as { access_token?: string }
    return res.ok ? data.access_token ?? shortLivedToken : shortLivedToken
  } catch {
    return shortLivedToken
  }
}

// 자격증명 캡처(meta) 는 callbacks.jwt 안의 token 교환에만 사용. session 검증은 자격증명 불필요.
function buildCommonOptions(meta?: MetaCredentials): AuthOptions {
  const providers: Providers = [
    CredentialsProvider({
      id: "guest",
      name: "Guest",
      credentials: {},
      async authorize() {
        return { id: "guest", name: "둘러보기 사용자", email: "guest@adflow.local" }
      },
    }),
  ]

  // 둘러보기 전용 환경(백엔드 미배포)에서는 실사용 로그인을 막는다 — 로그인에 성공해도
  // 영속 레이어가 없어 빈 화면이 된다. 게스트 provider 만 남긴다.
  const browseOnly = process.env.ADFLOW_BROWSE_ONLY === "true"

  // Meta 자격증명이 있을 때만 Facebook provider 등록. 없으면 마법사로 강제 이동 (middleware 가드).
  if (meta && !browseOnly) {
    providers.unshift(
      FacebookProvider({
        clientId: meta.clientId,
        clientSecret: meta.clientSecret,
        authorization: {
          url: "https://www.facebook.com/v20.0/dialog/oauth",
          params: { scope: SCOPE },
        },
      }),
    )
  }

  return {
    // 명시 지정 필수 — 없으면 NextAuth가 authOptions 해시로 자체 폴백해서
    // proxy.ts(withAuth, process.env.NEXTAUTH_SECRET 직접 참조)와 세션 암호화 키가 어긋난다.
    secret: process.env.NEXTAUTH_SECRET,
    debug: false,
    logger: {
      error(code) {
        console.error("[NextAuth][error]", code)
      },
      warn(code) {
        console.warn("[NextAuth][warn]", code)
      },
    },
    providers,
    pages: {
      signIn: "/login",
    },
    callbacks: {
      async jwt({ token, account, trigger, session }) {
        if (account?.provider === "guest") {
          token.browseMode = true
          if (!token.role) token.role = "팀장"
        }
        if (account && account.provider !== "guest") token.browseMode = false
        if (account?.access_token && meta) {
          token.accessToken = await exchangeForLongLivedToken(
            account.access_token,
            meta.clientId,
            meta.clientSecret,
          )
          // 첫 로그인 시 기본 역할: 팀장 (DB 연동 전 임시)
          if (!token.role) token.role = "팀장"
        }
        // 로그인 직후 Spring 백엔드와 1회 교환. 게스트·백엔드 미설정이면 내부에서 건너뛴다.
        // 실패해도 로그인을 깨지 않는다 — 단계 1 에서 프론트 데이터는 여전히 Supabase.
        if (account && token.email) {
          const issued = await exchangeForBackendToken({
            ownerKey: token.email,
            email: token.email,
            role: token.role,
            metaConnection: {
              accessToken: token.accessToken,
              igAccessToken: token.igAccessToken,
              adAccountId: token.adAccountId,
              adAccountName: token.adAccountName,
              pageId: token.pageId,
              pageName: token.pageName,
              pixelId: token.pixelId,
              pixelName: token.pixelName,
              igUserId: token.igUserId,
              igUsername: token.igUsername,
            },
          })
          if (issued) {
            token.backendToken = issued.token
            token.backendTokenExpiresAt = issued.expiresAt
            token.backendRefreshToken = issued.refreshToken
          }
        }
        if (trigger === "update" && session) {
          const requested = session as typeof session & { igSessionUpdate?: unknown }
          const currentToken = token as typeof token & { igSessionUpdateJti?: unknown }
          if (typeof requested.adAccountId === "string" && requested.adAccountId.length <= 200) {
            token.adAccountId = requested.adAccountId
            if (typeof requested.adAccountName === "string" && requested.adAccountName.length <= 200) token.adAccountName = requested.adAccountName
          }
          if (typeof requested.pageId === "string" && requested.pageId.length <= 200) {
            token.pageId = requested.pageId
            if (typeof requested.pageName === "string" && requested.pageName.length <= 200) token.pageName = requested.pageName
          }
          if (typeof requested.pixelId === "string" && requested.pixelId.length <= 200) {
            token.pixelId = requested.pixelId
            if (typeof requested.pixelName === "string" && requested.pixelName.length <= 200) token.pixelName = requested.pixelName
          }
          if (typeof requested.igUserId === "string" && requested.igUserId.length <= 200) {
            if (requested.igUserId !== token.igUserId) delete token.igAccessToken
            token.igUserId = requested.igUserId
            if (typeof requested.igUsername === "string" && requested.igUsername.length <= 200) token.igUsername = requested.igUsername
          }

          if (token.sub === "guest" && requested.browseMode === true) token.browseMode = true

          if (typeof requested.igSessionUpdate === "string" && process.env.NEXTAUTH_SECRET) {
            try {
              const issued = await decode({ token: requested.igSessionUpdate, secret: process.env.NEXTAUTH_SECRET }) as
                ({ purpose?: unknown; ownerKey?: unknown; igAccessToken?: unknown; igUserId?: unknown; igUsername?: unknown; exp?: unknown; jti?: unknown } | null)
              const ownerKey = token.sub ?? token.email ?? token.jti
              if (issued?.purpose === "ig-session-update" && issued.ownerKey === ownerKey &&
                typeof issued.jti === "string" && issued.jti !== currentToken.igSessionUpdateJti &&
                typeof issued.exp === "number" && issued.exp > Math.floor(Date.now() / 1000) &&
                typeof issued.igAccessToken === "string" && issued.igAccessToken.length > 0 &&
                typeof issued.igUserId === "string" && issued.igUserId.length > 0 &&
                typeof issued.igUsername === "string") {
                token.igAccessToken = issued.igAccessToken
                token.igUserId = issued.igUserId
                token.igUsername = issued.igUsername
                currentToken.igSessionUpdateJti = issued.jti
              }
            } catch {
              // Invalid client-supplied update capability is ignored.
            }
          }
        }
        return token
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken as string | undefined
        session.igAccessToken = token.igAccessToken as string | undefined
        session.adAccountId = token.adAccountId as string | undefined
        session.adAccountName = token.adAccountName as string | undefined
        session.pageId = token.pageId as string | undefined
        session.pageName = token.pageName as string | undefined
        session.pixelId = token.pixelId as string | undefined
        session.pixelName = token.pixelName as string | undefined
        session.igUserId = token.igUserId as string | undefined
        session.igUsername = token.igUsername as string | undefined
        session.browseMode = token.browseMode as boolean | undefined
        session.role = token.role as "팀장" | "팀원·게재" | "팀원·검토" | undefined
        // 둘러보기 모드: 실제 IG 연결이 없으므로 연결 탭과 동일한 데모 계정명으로 통일
        if (session.browseMode && !session.igUsername) session.igUsername = "greenroutine_official"
        return session
      },
    },
  }
}

// 정적 export — getServerSession(authOptions) 호출용. Facebook provider 없이도 세션 검증·읽기 동작.
// 기존 14개 import 사이트 호환.
export const authOptions: AuthOptions = buildCommonOptions()

// 동적 export — NextAuth 핸들러 전용. Meta 자격증명 캐시에서 매 요청 빌드.
export async function getAuthOptionsForNextAuth(): Promise<AuthOptions> {
  const meta = await credentialsCache.get()
  return buildCommonOptions(meta ?? undefined)
}
