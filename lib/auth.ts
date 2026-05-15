import type { AuthOptions } from "next-auth"
import FacebookProvider from "next-auth/providers/facebook"

const GRAPH = "https://graph.facebook.com/v20.0"

// Exchanges the short-lived (1-2h) login token for a 60-day long-lived token.
// Falls back to the short-lived token on failure — works for now but expires soon.
async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  try {
    const url =
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_CLIENT_ID}` +
      `&client_secret=${process.env.META_CLIENT_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
    const res = await fetch(url)
    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? shortLivedToken
  } catch {
    return shortLivedToken
  }
}

export const authOptions: AuthOptions = {
  debug: true,
  logger: {
    error(code, metadata) {
      console.error("[NextAuth][error]", code, JSON.stringify(metadata, null, 2))
    },
    warn(code) {
      console.warn("[NextAuth][warn]", code)
    },
  },
  providers: [
    FacebookProvider({
      clientId: process.env.META_CLIENT_ID!,
      clientSecret: process.env.META_CLIENT_SECRET!,
      authorization: {
        url: "https://www.facebook.com/v20.0/dialog/oauth",
        params: {
          scope: "public_profile,ads_management,ads_read,pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_manage_insights",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      if (account?.access_token) {
        token.accessToken = await exchangeForLongLivedToken(account.access_token)
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
