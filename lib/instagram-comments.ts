import { GRAPH, IG_GRAPH, getPageToken, getIgUserId } from "./instagram-graph"

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
  | { ok: false; error: string; status?: number }

export type IgDeleteResult =
  | { ok: true; mock?: boolean }
  | { ok: false; error: string; status?: number }

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

// igAccessToken 이 세션에 있지만 만료/무효화된 경우 Graph API 가 OAuthException 을 반환.
// "토큰 없음" 과 동일하게 목 폴백으로 처리.
function isOAuthException(body: GraphErrorBody): boolean {
  return body.error?.type === "OAuthException"
}

type ResolvedToken = { token: string; graphBase: string }

async function resolveIgToken(opts: {
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<ResolvedToken | null> {
  // IGAAX 토큰(Instagram Business Login)은 graph.instagram.com 전용
  if (opts.igAccessToken) return { token: opts.igAccessToken, graphBase: IG_GRAPH }
  if (!opts.pageId || !opts.accessToken) return null
  const pageToken = await getPageToken(opts.pageId, opts.accessToken)
  if (!pageToken) return null
  await getIgUserId(opts.pageId, pageToken)
  return { token: pageToken, graphBase: GRAPH }
}

export async function listComments(opts: {
  mediaId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCommentsResult> {
  const resolved = await resolveIgToken(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const url =
    `${resolved.graphBase}/${opts.mediaId}/comments` +
    `?fields=id,username,text,timestamp,like_count,hidden,replies.summary(true)` +
    `&limit=100` +
    `&access_token=${resolved.token}`
  const res = await fetch(url)
  const body = await res.json().catch(() => ({})) as {
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
  if (!res.ok || body.error) {
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요." }
    return { ok: false, status: res.status, error: body.error?.message ?? "댓글 조회 실패" }
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
  | { ok: false; error: string; status?: number }

export type IgCreateResult =
  | { ok: true; id: string; mock?: boolean }
  | { ok: false; error: string; status?: number }

export async function hideComment(opts: {
  commentId: string
  hidden: boolean
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgHideResult> {
  const resolved = await resolveIgToken(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(
    `${resolved.graphBase}/${opts.commentId}?hidden=${opts.hidden}&access_token=${resolved.token}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요." }
    return { ok: false, status: res.status, error: body.error?.message ?? "댓글 숨김 실패" }
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
  const resolved = await resolveIgToken(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(
    `${resolved.graphBase}/${opts.mediaId}/comments?message=${encodeURIComponent(opts.message)}&access_token=${resolved.token}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요." }
    return { ok: false, status: res.status, error: body.error?.message ?? "댓글 작성 실패" }
  }
  const body = await res.json() as { id?: string }
  return { ok: true, id: body.id ?? `created-${Date.now()}` }
}

export async function listReplies(opts: {
  commentId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCommentsResult> {
  const resolved = await resolveIgToken(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const url =
    `${resolved.graphBase}/${opts.commentId}/replies` +
    `?fields=id,username,text,timestamp,like_count,hidden` +
    `&access_token=${resolved.token}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요." }
    return { ok: false, status: res.status, error: body.error?.message ?? "답글 조회 실패" }
  }
  const body = await res.json() as {
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
  const resolved = await resolveIgToken(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(
    `${resolved.graphBase}/${opts.commentId}/replies?message=${encodeURIComponent(opts.message)}&access_token=${resolved.token}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요." }
    return { ok: false, status: res.status, error: body.error?.message ?? "답글 작성 실패" }
  }
  const body = await res.json() as { id?: string }
  return { ok: true, id: body.id ?? `reply-${Date.now()}` }
}

export async function deleteComment(opts: {
  commentId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgDeleteResult> {
  const resolved = await resolveIgToken(opts)
  if (!resolved) return { ok: false, error: "IG 계정이 연결되지 않았어요." }

  const res = await fetch(`${resolved.graphBase}/${opts.commentId}?access_token=${resolved.token}`, { method: "DELETE" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as GraphErrorBody
    if (isOAuthException(body)) return { ok: false, error: "토큰이 만료되었어요. IG 계정을 다시 연결해 주세요." }
    return { ok: false, status: res.status, error: body.error?.message ?? "댓글 삭제 실패" }
  }
  return { ok: true }
}
