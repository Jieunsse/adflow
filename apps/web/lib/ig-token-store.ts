import { decrypt, encrypt } from "./meta-credentials"

export const IG_STATE_COOKIE = "adflow_ig_state"
export const IG_PENDING_COOKIE = "adflow_ig_pending"
export const INSTAGRAM_REQUIRED_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const

export type IgState = {
  state: string
  ownerKey: string
  redirectUri: string
  expiresAt: number
}

export type IgPending = {
  ownerKey: string
  igAccessToken: string
  igUserId: string
  igUsername: string
  expiresAt: number
}

function seal(value: object): string | null {
  try {
    return encrypt(JSON.stringify(value))
  } catch {
    return null
  }
}

function open<T>(value: string): T | null {
  try {
    return JSON.parse(decrypt(value)) as T
  } catch {
    return null
  }
}

export function sealIgState(state: Omit<IgState, "expiresAt">): string | null {
  return seal({ ...state, expiresAt: Date.now() + 5 * 60 * 1000 })
}

export function openIgState(value: string): IgState | null {
  const state = open<IgState>(value)
  return state && typeof state.state === "string" && typeof state.ownerKey === "string" &&
    typeof state.redirectUri === "string" && typeof state.expiresAt === "number" && state.expiresAt > Date.now()
    ? state
    : null
}

export function sealIgPending(pending: Omit<IgPending, "expiresAt">): string | null {
  return seal({ ...pending, expiresAt: Date.now() + 5 * 60 * 1000 })
}

export function openIgPending(value: string): IgPending | null {
  const pending = open<IgPending>(value)
  return pending && typeof pending.ownerKey === "string" && typeof pending.igAccessToken === "string" &&
    typeof pending.igUserId === "string" && typeof pending.igUsername === "string" &&
    typeof pending.expiresAt === "number" && pending.expiresAt > Date.now()
    ? pending
    : null
}

export function getInstagramRedirectUri(req: { nextUrl: { origin: string } }): string | null {
  try {
    const publicOrigin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : req.nextUrl.origin
    const configured = process.env.INSTAGRAM_REDIRECT_URI?.trim()
    const redirectUri = configured ?? `${publicOrigin}/api/instagram/callback`
    const url = new URL(redirectUri)
    if (url.origin !== publicOrigin || url.pathname !== "/api/instagram/callback" || url.search || url.hash || url.username || url.password) return null
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}
