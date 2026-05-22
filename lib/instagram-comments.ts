const GRAPH = "https://graph.facebook.com/v20.0"

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
    { id: "mc1", username: "minji_lee",   text: "이거 어디서 살 수 있나요?",                timestamp: "2026-05-22T13:20:00Z", likeCount: 3, hidden: false, replyCount: 0 },
    { id: "mc2", username: "studio.kim",  text: "색감 너무 예뻐요 ✨",                       timestamp: "2026-05-22T12:05:00Z", likeCount: 7, hidden: false, replyCount: 1 },
    { id: "mc3", username: "spam_xx_99",  text: "💰💰 DM 주세요 부업 안내",                  timestamp: "2026-05-22T10:48:00Z", likeCount: 0, hidden: false, replyCount: 0 },
    { id: "mc4", username: "yuna___",     text: "사이즈 정보 추가 부탁드려요!",              timestamp: "2026-05-21T18:30:00Z", likeCount: 2, hidden: false, replyCount: 0 },
    { id: "mc5", username: "daily.shop",  text: "재입고 알림 신청 어떻게 하나요?",           timestamp: "2026-05-21T17:15:00Z", likeCount: 1, hidden: false, replyCount: 0 },
  ],
}

export function getMockComments(mediaId: string): IgComment[] {
  return IG_COMMENTS_MOCK[mediaId] ?? IG_COMMENTS_MOCK.default
}

async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`)
  if (!res.ok) return null
  const data = await res.json() as { access_token?: string }
  return data.access_token ?? null
}

async function getIgUserId(pageId: string, pageToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`)
  if (!res.ok) return null
  const data = await res.json() as { instagram_business_account?: { id: string } }
  return data.instagram_business_account?.id ?? null
}

async function resolveIgToken(opts: {
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<string | null> {
  if (opts.igAccessToken) return opts.igAccessToken
  if (!opts.pageId || !opts.accessToken) return null
  const pageToken = await getPageToken(opts.pageId, opts.accessToken)
  if (!pageToken) return null
  // IG 댓글은 page token 으로 호출 가능 (Page → IG 비즈 계정 연결 시)
  await getIgUserId(opts.pageId, pageToken)
  return pageToken
}

export async function listComments(opts: {
  mediaId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgCommentsResult> {
  const token = await resolveIgToken(opts)
  if (!token) return { ok: true, items: getMockComments(opts.mediaId), mock: true }

  const url =
    `${GRAPH}/${opts.mediaId}/comments` +
    `?fields=id,username,text,timestamp,like_count,hidden,replies.summary(true)` +
    `&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return { ok: false, status: res.status, error: body.error?.message ?? "댓글 조회 실패" }
  }
  const body = await res.json() as {
    data?: Array<{
      id: string
      username?: string
      text?: string
      timestamp?: string
      like_count?: number
      hidden?: boolean
      replies?: { summary?: { total_count?: number } }
    }>
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

export async function deleteComment(opts: {
  commentId: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<IgDeleteResult> {
  const token = await resolveIgToken(opts)
  if (!token) return { ok: true, mock: true }

  const res = await fetch(`${GRAPH}/${opts.commentId}?access_token=${token}`, { method: "DELETE" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return { ok: false, status: res.status, error: body.error?.message ?? "댓글 삭제 실패" }
  }
  return { ok: true }
}
