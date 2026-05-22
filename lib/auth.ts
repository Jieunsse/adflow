import type { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import FacebookProvider from "next-auth/providers/facebook"
import { credentialsCache, type MetaCredentials } from "./meta-credentials"

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

  // Meta 자격증명이 있을 때만 Facebook provider 등록. 없으면 마법사로 강제 이동 (middleware 가드).
  if (meta) {
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
          // 첫 로그인 시 기본 역할: 팀장 (DB 연동 전 임시)
          if (!token.role) token.role = "팀장"
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
          if (session.role !== undefined) {
            token.role = session.role
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
