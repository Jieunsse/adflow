import type { AuthOptions } from "next-auth"
import FacebookProvider from "next-auth/providers/facebook"

const GRAPH = "https://graph.facebook.com/v20.0"

// 로그인 직후 받은 단기(1~2시간) 토큰을 60일짜리 long-lived 토큰으로 교환해요.
// 교환에 실패하면 단기 토큰을 그대로 써요 (당장은 동작, 곧 만료).
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
        params: {
          scope: "public_profile,ads_management,ads_read,pages_show_list",
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
        if (session.browseMode !== undefined) {
          token.browseMode = session.browseMode
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
      session.browseMode = token.browseMode as boolean | undefined
      return session
    },
  },
}
