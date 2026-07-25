import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    igAccessToken?: string
    adAccountId?: string
    adAccountName?: string
    pageId?: string
    pageName?: string
    pixelId?: string
    pixelName?: string
    igUserId?: string
    igUsername?: string
    browseMode?: boolean
    role?: "팀장" | "팀원·게재" | "팀원·검토"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    igAccessToken?: string
    adAccountId?: string
    adAccountName?: string
    pageId?: string
    pageName?: string
    pixelId?: string
    pixelName?: string
    igUserId?: string
    igUsername?: string
    browseMode?: boolean
    role?: "팀장" | "팀원·게재" | "팀원·검토"
  }
}
