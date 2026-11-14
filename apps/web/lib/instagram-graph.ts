export const GRAPH = "https://graph.facebook.com/v20.0"
export const IG_GRAPH = "https://graph.instagram.com"

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message)
    this.name = "MetaGraphError"
  }
}

export async function readGraphBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function graphErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error?: { message?: string } }).error
    if (error?.message) return error.message
  }
  return fallback
}

export function hasGraphError(body: unknown): boolean {
  return typeof body === "object" && body !== null && "error" in body && Boolean(body.error)
}

export function graphStatus(status: number, body: unknown): number {
  return hasGraphError(body) && status < 400 ? 502 : status || 502
}

export type InstagramCredentials = {
  igUserId: string
  token: string
  graphBase: string
}

export async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`, { cache: "no-store" })
  const body = await readGraphBody(res)
  if (!res.ok || hasGraphError(body)) {
    throw new MetaGraphError(graphErrorMessage(body, "Facebook Page token 조회 실패"), graphStatus(res.status, body), body)
  }
  return (body as { access_token?: string }).access_token ?? null
}

export async function getIgUserId(pageId: string, pageToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`, { cache: "no-store" })
  const body = await readGraphBody(res)
  if (!res.ok || hasGraphError(body)) {
    throw new MetaGraphError(graphErrorMessage(body, "Instagram 계정 조회 실패"), graphStatus(res.status, body), body)
  }
  return (body as { instagram_business_account?: { id: string } }).instagram_business_account?.id ?? null
}

export async function resolveInstagramCredentials(opts: {
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<InstagramCredentials | null> {
  if (opts.igUserId && opts.igAccessToken) {
    return { igUserId: opts.igUserId, token: opts.igAccessToken, graphBase: IG_GRAPH }
  }
  if (!opts.pageId || !opts.accessToken) return null
  const pageToken = await getPageToken(opts.pageId, opts.accessToken)
  if (!pageToken) return null
  const igUserId = opts.igUserId || (await getIgUserId(opts.pageId, pageToken))
  if (!igUserId) return null
  return { igUserId, token: pageToken, graphBase: GRAPH }
}
