import { graphErrorMessage, graphStatus, hasGraphError, readGraphBody, resolveInstagramCredentials } from "./instagram-graph"

export type IgComment = {
  id: string
  username: string
  text: string
  timestamp: string
  likeCount: number
  hidden: boolean
  replyCount: number
}

export type IgCommentsResult =
  | { ok: true; items: IgComment[]; mock?: boolean }
  | { ok: false; error: string; status?: number; body?: unknown }

export type IgDeleteResult =
  | { ok: true; mock?: boolean }
  | { ok: false; error: string; status?: number; body?: unknown }

export const IG_COMMENTS_MOCK: Record<string, IgComment[]> = {
  default: [
    { id: "mc1", username: "minji_lee",   text: "이 수분 크림 어디서 살 수 있나요?",         timestamp: "2026-05-22T13:20:00Z", likeCount: 3, hidden: false, replyCount: 0 },
    { id: "mc2", username: "studio.kim",  text: "무향이라 아침에 쓰기 좋아요 ✨",            timestamp: "2026-05-22T12:05:00Z", likeCount: 7, hidden: false, replyCount: 2 },
    { id: "mc3", username: "spam_xx_99",  text: "💰💰 DM 주세요 부업 안내",                  timestamp: "2026-05-22T10:48:00Z", likeCount: 0, hidden: false, replyCount: 0 },
    { id: "mc4", username: "yuna___",     text: "지성 피부도 써도 괜찮을까요?",             timestamp: "2026-05-21T18:30:00Z", likeCount: 2, hidden: false, replyCount: 1 },
    { id: "mc5", username: "daily.shop",  text: "재입고 알림 신청 어떻게 하나요?",           timestamp: "2026-05-21T17:15:00Z", likeCount: 1, hidden: false, replyCount: 0 },
  ],
}

export const IG_REPLIES_MOCK: Record<string, IgComment[]> = {
  mc2: [
    { id: "mr2-1", username: "greenroutine_official", text: "감사해요! 저희 홈페이지에서 구매하실 수 있어요 🌿", timestamp: "2026-05-22T12:30:00Z", likeCount: 4, hidden: false, replyCount: 0 },
    { id: "mr2-2", username: "studio.kim",            text: "감사합니다 꼭 구매해볼게요!",                      timestamp: "2026-05-22T12:45:00Z", likeCount: 1, hidden: false, replyCount: 0 },
  ],
  mc4: [
    { id: "mr4-1", username: "greenroutine_official", text: "지성 피부도 편하게 쓰실 수 있어요! 무향·무색소라 자극을 줄였어요 🌿", timestamp: "2026-05-21T19:00:00Z", likeCount: 2, hidden: false, replyCount: 0 },
  ],
}

export function getMockComments(mediaId: string): IgComment[] {
  return IG_COMMENTS_MOCK[mediaId] ?? IG_COMMENTS_MOCK.default
}

export function getMockReplies(commentId: string): IgComment[] {
  return IG_REPLIES_MOCK[commentId] ?? []
}

type GraphErrorBody = { error?: { message?: string; type?: string } }

function isOAuthException(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !("error" in body)) return false
  const error = body.error
  return typeof error === "object" && error !== null && "type" in error && error.type === "OAuthException"
}

export async function listComments(opts: {
  mediaId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCommentsResult> {
  const resolved = await resolveInstagramCredentials(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const url =
    `${resolved.graphBase}/${opts.mediaId}/comments` +
    `?fields=id,username,text,timestamp,like_count,hidden,replies.summary(true)` +
    `&limit=100` +
    `&access_token=${resolved.token}`
  const res = await fetch(url, { cache: "no-store" })
  const body = await readGraphBody(res) as {
    data?: Array<{
      id: string
      username?: string
      text?: string
      timestamp?: string
      like_count?: number
      hidden?: boolean
      replies?: { summary?: { total_count?: number } }
    }>
    error?: { message?: string; type?: string }
  }
  if (!res.ok || hasGraphError(body)) {
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요.", status: graphStatus(res.status, body), body }
    return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "댓글 조회 실패"), body }
  }
  const items: IgComment[] = (body.data ?? []).map((c) => ({
    id: c.id,
    username: c.username ?? "unknown",
    text: c.text ?? "",
    timestamp: c.timestamp ?? "",
    likeCount: c.like_count ?? 0,
    hidden: c.hidden ?? false,
    replyCount: c.replies?.summary?.total_count ?? 0,
  }))
  return { ok: true, items }
}

export type IgHideResult =
  | { ok: true; mock?: boolean }
  | { ok: false; error: string; status?: number; body?: unknown }

export type IgCreateResult =
  | { ok: true; id: string; mock?: boolean }
  | { ok: false; error: string; status?: number; body?: unknown }

export async function hideComment(opts: {
  commentId: string
  hidden: boolean
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgHideResult> {
  const resolved = await resolveInstagramCredentials(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(
    `${resolved.graphBase}/${opts.commentId}?hidden=${opts.hidden}&access_token=${resolved.token}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const body = await readGraphBody(res) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요.", status: graphStatus(res.status, body), body }
    return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "댓글 숨김 실패"), body }
  }
  return { ok: true }
}

export async function createComment(opts: {
  mediaId: string
  message: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCreateResult> {
  const resolved = await resolveInstagramCredentials(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(
    `${resolved.graphBase}/${opts.mediaId}/comments?message=${encodeURIComponent(opts.message)}&access_token=${resolved.token}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const body = await readGraphBody(res) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요.", status: graphStatus(res.status, body), body }
    return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "댓글 작성 실패"), body }
  }
  const body = await readGraphBody(res) as { id?: string }
  return { ok: true, id: body.id ?? `created-${Date.now()}` }
}

export async function listReplies(opts: {
  commentId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCommentsResult> {
  const resolved = await resolveInstagramCredentials(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const url =
    `${resolved.graphBase}/${opts.commentId}/replies` +
    `?fields=id,username,text,timestamp,like_count,hidden` +
    `&access_token=${resolved.token}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    const body = await readGraphBody(res) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요.", status: graphStatus(res.status, body), body }
    return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "답글 조회 실패"), body }
  }
  const body = await readGraphBody(res) as {
    data?: Array<{
      id: string
      username?: string
      text?: string
      timestamp?: string
      like_count?: number
      hidden?: boolean
    }>
  }
  const items: IgComment[] = (body.data ?? []).map((c) => ({
    id: c.id,
    username: c.username ?? "unknown",
    text: c.text ?? "",
    timestamp: c.timestamp ?? "",
    likeCount: c.like_count ?? 0,
    hidden: c.hidden ?? false,
    replyCount: 0,
  }))
  return { ok: true, items }
}

export async function replyToComment(opts: {
  commentId: string
  message: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCreateResult> {
  const resolved = await resolveInstagramCredentials(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(
    `${resolved.graphBase}/${opts.commentId}/replies?message=${encodeURIComponent(opts.message)}&access_token=${resolved.token}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const body = await readGraphBody(res) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요.", status: graphStatus(res.status, body), body }
    return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "답글 작성 실패"), body }
  }
  const body = await readGraphBody(res) as { id?: string }
  return { ok: true, id: body.id ?? `reply-${Date.now()}` }
}

export async function deleteComment(opts: {
  commentId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgDeleteResult> {
  const resolved = await resolveInstagramCredentials(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(`${resolved.graphBase}/${opts.commentId}?access_token=${resolved.token}`, { method: "DELETE" })
  if (!res.ok) {
    const body = await readGraphBody(res) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요.", status: graphStatus(res.status, body), body }
    return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "댓글 삭제 실패"), body }
  }
  return { ok: true }
}
