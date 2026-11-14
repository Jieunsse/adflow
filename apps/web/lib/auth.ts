import type { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import FacebookProvider from "next-auth/providers/facebook"
import GoogleProvider from "next-auth/providers/google"
import KakaoProvider from "next-auth/providers/kakao"
import { credentialsCache, type MetaCredentials } from "./meta-credentials"
import { exchangeForBackendToken } from "@shared/lib/backend/exchange"
import { callAccount } from "@shared/lib/backend/account"

// 고객 로그인 방법 (정책서 3.1). 직원은 Facebook 으로만 들어온다.
const CLIENT_PROVIDERS = new Set(["client-email", "google", "kakao"])

type Providers = NonNullable<AuthOptions["providers"]>

const GRAPH = "https://graph.facebook.com/v20.0"
const SCOPE =
  "public_profile,ads_management,ads_read,pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_manage_insights"

// Exchanges the short-lived (1-2h) login token for a 60-day long-lived token.
// Falls back to the short-lived token on failure — works for now but expires soon.
async function exchangeForLongLivedToken(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  try {
    const url =
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${clientId}` +
      `&client_secret=${clientSecret}` +
      `&fb_exchange_token=${shortLivedToken}`
    const res = await fetch(url)
    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? shortLivedToken
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

  if (!browseOnly) {
    providers.push(
      CredentialsProvider({
        id: "client-email",
        name: "이메일",
        credentials: { email: { type: "email" }, password: { type: "password" } },
        async authorize(credentials) {
          // 잠금·인증 여부·고객 등록 확인은 서버가 한다. 실패 문구는 그대로 로그인 화면에 보인다.
          const r = await callAccount("login", { email: credentials?.email, password: credentials?.password })
          if (!r.ok) throw new Error(r.data.error ?? "로그인하지 못했어요. 잠시 뒤 다시 해 주세요.")
          const email = String(r.data.email)
          return { id: email, email, name: email }
        },
      }),
    )
    // 카카오·구글은 개발자 콘솔에 앱을 등록해 키를 넣었을 때만 켠다.
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      providers.push(
        GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }),
      )
    }
    if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET) {
      providers.push(
        KakaoProvider({ clientId: process.env.KAKAO_CLIENT_ID, clientSecret: process.env.KAKAO_CLIENT_SECRET }),
      )
    }
  }

  return {
    // 명시 지정 필수 — 없으면 NextAuth가 authOptions 해시로 자체 폴백해서
    // proxy.ts(withAuth, process.env.NEXTAUTH_SECRET 직접 참조)와 세션 암호화 키가 어긋난다.
    secret: process.env.NEXTAUTH_SECRET,
    debug: true,
    logger: {
      error(code, metadata) {
        console.error("[NextAuth][error]", code, JSON.stringify(metadata, null, 2))
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
      // 카카오·구글은 그 서비스가 확인한 이메일이고, 직원이 고객으로 등록한 이메일일 때만 들어온다.
      async signIn({ account, profile, user }) {
        if (account?.provider !== "google" && account?.provider !== "kakao") return true
        const p = profile as { email_verified?: boolean; kakao_account?: { email?: string; is_email_verified?: boolean } } | undefined
        const verified = account.provider === "google" ? p?.email_verified === true : p?.kakao_account?.is_email_verified === true
        const email = user.email ?? p?.kakao_account?.email
        if (!verified || !email) return "/login?error=EmailNotVerified"
        const r = await callAccount("client-check", { email })
        return r.ok ? true : "/login?error=NotClient"
      },
      async jwt({ token, account, trigger, session }) {
        if (account?.provider === "guest") {
          token.browseMode = true
          if (!token.role) token.role = "팀장"
        }
        if (account?.access_token && meta) {
          token.accessToken = await exchangeForLongLivedToken(
            account.access_token,
            meta.clientId,
            meta.clientSecret,
          )
        }
        // 로그인 직후 Spring 백엔드와 1회 교환. 게스트·백엔드 미설정이면 내부에서 건너뛴다.
        // 실패해도 로그인을 깨지 않는다 — 단계 1 에서 프론트 데이터는 여전히 Supabase.
        if (account && token.email) {
          const issued = await exchangeForBackendToken({
            ownerKey: token.email,
            email: token.email,
            client: CLIENT_PROVIDERS.has(account.provider),
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
            token.role = issued.role
          } else if (!token.role && !CLIENT_PROVIDERS.has(account.provider)) {
            // 백엔드가 없는 환경(설치 마법사·로컬)에서는 막을 서버도 없다. 예전처럼 팀장으로 둔다.
            // 고객 로그인은 여기서 팀장이 되면 안 된다 — 역할 없이 두면 화면 가드가 막는다.
            token.role = "팀장"
          }
        }
        if (trigger === "update" && session) {
          if (session.adAccountId !== undefined) {
            token.adAccountId = session.adAccountId
            token.adAccountName = session.adAccountName
          }
          if (session.pageId !== undefined) {
            token.pageId = session.pageId
            token.pageName = session.pageName
          }
          if (session.pixelId !== undefined) {
            token.pixelId = session.pixelId
            token.pixelName = session.pixelName
          }
          if (session.igUserId !== undefined) {
            token.igUserId = session.igUserId
            token.igUsername = session.igUsername
          }
          if (session.igAccessToken !== undefined) {
            token.igAccessToken = session.igAccessToken
          }
          if (session.browseMode !== undefined) {
            token.browseMode = session.browseMode
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
        session.role = token.role as "팀장" | "팀원·게재" | "팀원·검토" | "고객" | undefined
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
