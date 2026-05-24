import { GRAPH, IG_GRAPH, getPageToken, getIgUserId } from "./instagram-graph"

export type IgPost = {
  id: string
  mediaUrl: string
  caption: string
  likeCount: number
  commentCount: number
  savedCount: number
  timestamp: string
}

export type IgAccountInsights = {
  followers: number
  reach: number
  profileViews: number
  engagementRate: number
  igUsername?: string
  posts: IgPost[]
  mock: boolean
}

export const IG_MOCK_GOOD: IgAccountInsights = {
  followers: 12400,
  reach: 45200,
  profileViews: 1830,
  engagementRate: 4.2,
  igUsername: "brand_account",
  mock: true,
  posts: [
    { id: "ig1", mediaUrl: "https://picsum.photos/seed/ig1/200/200", caption: "새로운 시즌 컬렉션 출시! ✨", likeCount: 847, commentCount: 63, savedCount: 124, timestamp: "2026-05-10T09:00:00Z" },
    { id: "ig2", mediaUrl: "https://picsum.photos/seed/ig2/200/200", caption: "고객 인터뷰 — 브랜드를 선택한 이유", likeCount: 612, commentCount: 41, savedCount: 89, timestamp: "2026-05-07T11:30:00Z" },
    { id: "ig3", mediaUrl: "https://picsum.photos/seed/ig3/200/200", caption: "제품 뒷이야기 🎬", likeCount: 1024, commentCount: 78, savedCount: 201, timestamp: "2026-05-03T14:00:00Z" },
    { id: "ig4", mediaUrl: "https://picsum.photos/seed/ig4/200/200", caption: "주말 이벤트 안내", likeCount: 398, commentCount: 29, savedCount: 55, timestamp: "2026-04-28T10:00:00Z" },
    { id: "ig5", mediaUrl: "https://picsum.photos/seed/ig5/200/200", caption: "팔로워 Q&A 정리", likeCount: 723, commentCount: 112, savedCount: 167, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

export const IG_MOCK_POOR: IgAccountInsights = {
  followers: 3200,
  reach: 8100,
  profileViews: 290,
  engagementRate: 0.6,
  igUsername: "brand_account",
  mock: true,
  posts: [
    { id: "ip1", mediaUrl: "https://picsum.photos/seed/ip1/200/200", caption: "신제품 안내", likeCount: 28, commentCount: 2, savedCount: 3, timestamp: "2026-05-10T09:00:00Z" },
    { id: "ip2", mediaUrl: "https://picsum.photos/seed/ip2/200/200", caption: "이번 주 소식", likeCount: 19, commentCount: 1, savedCount: 1, timestamp: "2026-05-07T11:30:00Z" },
    { id: "ip3", mediaUrl: "https://picsum.photos/seed/ip3/200/200", caption: "할인 이벤트", likeCount: 34, commentCount: 3, savedCount: 4, timestamp: "2026-05-03T14:00:00Z" },
    { id: "ip4", mediaUrl: "https://picsum.photos/seed/ip4/200/200", caption: "브랜드 소개", likeCount: 12, commentCount: 0, savedCount: 2, timestamp: "2026-04-28T10:00:00Z" },
    { id: "ip5", mediaUrl: "https://picsum.photos/seed/ip5/200/200", caption: "5월 프로모션", likeCount: 21, commentCount: 1, savedCount: 1, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

export type IgInsightsDebug = {
  pageId: string
  hasUserToken: boolean
  pageTokenObtained: boolean
  igUserId: string | null
  tokenScopes?: string[]
  tokenIsValid?: boolean
  tokenAppId?: string
  tokenUserId?: string
  tokenExpiresAt?: number
  tokenDebugError?: string
  accountStatus?: number
  accountBody?: unknown
  insightsStatus?: number
  insightsBody?: unknown
  mediaStatus?: number
  mediaBody?: unknown
  caught?: string
}

export async function debugInstagramInsights(
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
): Promise<IgInsightsDebug> {
  const debug: IgInsightsDebug = {
    pageId: pageId ?? "(empty)",
    hasUserToken: !!userToken,
    pageTokenObtained: false,
    igUserId: null,
  }
  if (!pageId || !userToken) return debug
  try {
    const pageToken = await getPageToken(pageId, userToken)
    debug.pageTokenObtained = !!pageToken
    if (!pageToken) return debug
    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    debug.igUserId = igUserId
    if (!igUserId) return debug
    const accountRes = await fetch(`${GRAPH}/${igUserId}?fields=followers_count,username&access_token=${pageToken}`)
    debug.accountStatus = accountRes.status
    debug.accountBody = await accountRes.json()
    const insightsRes = await fetch(`${GRAPH}/${igUserId}/insights?metric=reach&period=days_28&access_token=${pageToken}`)
    debug.insightsStatus = insightsRes.status
    debug.insightsBody = await insightsRes.json()
    const mediaRes = await fetch(`${GRAPH}/${igUserId}/media?fields=id,caption,media_url,thumbnail_url,like_count,comments_count,timestamp&limit=5&access_token=${pageToken}`)
    debug.mediaStatus = mediaRes.status
    debug.mediaBody = await mediaRes.json()
  } catch (e) {
    debug.caught = e instanceof Error ? e.message : String(e)
  }
  return debug
}

async function fetchMediaInsights(mediaId: string, token: string, graphBase: string): Promise<{ saved: number; reach: number }> {
  try {
    const res = await fetch(`${graphBase}/${mediaId}/insights?metric=saved,reach&access_token=${token}`)
    if (!res.ok) return { saved: 0, reach: 0 }
    const body = await res.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> }
    const pick = (name: string) => body.data?.find(d => d.name === name)?.values[0]?.value ?? 0
    return { saved: pick("saved"), reach: pick("reach") }
  } catch {
    return { saved: 0, reach: 0 }
  }
}

async function fetchInsightsWithToken(igUserId: string, token: string, graphBase: string): Promise<IgAccountInsights> {
  // profile_views 는 v22+ 부터 metric_type=total_value 필수. reach 는 기존 period 기반.
  const [accountRes, reachRes, profileViewsRes, mediaRes] = await Promise.all([
    fetch(`${graphBase}/${igUserId}?fields=followers_count,username&access_token=${token}`),
    fetch(`${graphBase}/${igUserId}/insights?metric=reach&period=days_28&access_token=${token}`),
    fetch(`${graphBase}/${igUserId}/insights?metric=profile_views&metric_type=total_value&period=day&access_token=${token}`),
    fetch(`${graphBase}/${igUserId}/media?fields=id,caption,media_url,thumbnail_url,like_count,comments_count,timestamp&limit=5&access_token=${token}`),
  ])

  // account 가 실패하면 IG 계정 식별 자체가 안 된 거라 mock 으로 떨어뜨림.
  if (!accountRes.ok) return IG_MOCK_GOOD

  const account = await accountRes.json() as { followers_count?: number; username?: string }
  const reachData = await reachRes.json() as {
    data?: Array<{ name: string; values: Array<{ value: number }> }>
  }
  const profileViewsData = await profileViewsRes.json() as {
    data?: Array<{ name: string; total_value?: { value: number } }>
  }
  const mediaData = await mediaRes.json() as {
    data?: Array<{
      id: string; caption?: string; media_url?: string; thumbnail_url?: string
      like_count?: number; comments_count?: number; timestamp?: string
    }>
  }

  const reach = reachData.data?.find(d => d.name === "reach")?.values.reduce((s, v) => s + v.value, 0) ?? 0
  const profileViews = profileViewsData.data?.find(d => d.name === "profile_views")?.total_value?.value ?? 0
  const followers = account.followers_count ?? 0

  const rawMedia = mediaData.data ?? []
  const mediaInsights = await Promise.all(rawMedia.map(m => fetchMediaInsights(m.id, token, graphBase)))
  const posts: IgPost[] = rawMedia.map((m, i) => ({
    id: m.id,
    mediaUrl: m.thumbnail_url ?? m.media_url ?? "",
    caption: m.caption ?? "",
    likeCount: m.like_count ?? 0,
    commentCount: m.comments_count ?? 0,
    savedCount: mediaInsights[i].saved,
    timestamp: m.timestamp ?? "",
  }))

  const totalEngagement = posts.reduce((s, p) => s + p.likeCount + p.commentCount + p.savedCount, 0)
  const engagementRate = followers > 0 && posts.length > 0
    ? Number(((totalEngagement / posts.length / followers) * 100).toFixed(1))
    : 0

  return { followers, reach, profileViews, engagementRate, igUsername: account.username, posts, mock: false }
}

export async function getInstagramInsights(
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
  igAccessToken?: string,
): Promise<IgAccountInsights> {
  // Instagram Business Login 토큰이 있으면 page token 없이 직접 호출
  if (igAccessToken && igUserIdHint) {
    try {
      return await fetchInsightsWithToken(igUserIdHint, igAccessToken, IG_GRAPH)
    } catch {
      return IG_MOCK_GOOD
    }
  }

  if (!pageId || !userToken) return IG_MOCK_GOOD
  try {
    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return IG_MOCK_GOOD

    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    if (!igUserId) return IG_MOCK_GOOD

    return await fetchInsightsWithToken(igUserId, pageToken, GRAPH)
  } catch {
    return IG_MOCK_GOOD
  }
}
