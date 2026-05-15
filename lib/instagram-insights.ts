const GRAPH = "https://graph.facebook.com/v20.0"

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

const MOCK: IgAccountInsights = {
  followers: 12400,
  reach: 45200,
  profileViews: 1830,
  engagementRate: 4.2,
  igUsername: "brand_account",
  mock: true,
  posts: [
    { id: "m1", mediaUrl: "", caption: "새로운 시즌 컬렉션 출시! ✨", likeCount: 847, commentCount: 63, savedCount: 124, timestamp: "2026-05-10T09:00:00Z" },
    { id: "m2", mediaUrl: "", caption: "고객 인터뷰 — 브랜드를 선택한 이유", likeCount: 612, commentCount: 41, savedCount: 89, timestamp: "2026-05-07T11:30:00Z" },
    { id: "m3", mediaUrl: "", caption: "제품 뒷이야기 🎬", likeCount: 1024, commentCount: 78, savedCount: 201, timestamp: "2026-05-03T14:00:00Z" },
    { id: "m4", mediaUrl: "", caption: "주말 이벤트 안내", likeCount: 398, commentCount: 29, savedCount: 55, timestamp: "2026-04-28T10:00:00Z" },
    { id: "m5", mediaUrl: "", caption: "팔로워 Q&A 정리", likeCount: 723, commentCount: 112, savedCount: 167, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`)
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

async function getIgUserId(pageId: string, pageToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`)
    const data = await res.json() as { instagram_business_account?: { id: string } }
    return data.instagram_business_account?.id ?? null
  } catch {
    return null
  }
}

export async function getInstagramInsights(
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
): Promise<IgAccountInsights> {
  if (!pageId || !userToken) return MOCK
  try {
    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return MOCK

    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    if (!igUserId) return MOCK

    const [accountRes, insightsRes, mediaRes] = await Promise.all([
      fetch(`${GRAPH}/${igUserId}?fields=followers_count,username&access_token=${pageToken}`),
      fetch(`${GRAPH}/${igUserId}/insights?metric=reach,profile_views&period=days_28&access_token=${pageToken}`),
      fetch(`${GRAPH}/${igUserId}/media?fields=id,caption,media_url,thumbnail_url,like_count,comments_count,timestamp&limit=5&access_token=${pageToken}`),
    ])

    const account = await accountRes.json() as { followers_count?: number; username?: string }
    const insightsData = await insightsRes.json() as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>
    }
    const mediaData = await mediaRes.json() as {
      data?: Array<{
        id: string; caption?: string; media_url?: string; thumbnail_url?: string
        like_count?: number; comments_count?: number; timestamp?: string
      }>
    }

    const reach = insightsData.data?.find(d => d.name === "reach")?.values.reduce((s, v) => s + v.value, 0) ?? 0
    const profileViews = insightsData.data?.find(d => d.name === "profile_views")?.values.reduce((s, v) => s + v.value, 0) ?? 0
    const followers = account.followers_count ?? 0

    const posts: IgPost[] = (mediaData.data ?? []).map(m => ({
      id: m.id,
      mediaUrl: m.thumbnail_url ?? m.media_url ?? "",
      caption: m.caption ?? "",
      likeCount: m.like_count ?? 0,
      commentCount: m.comments_count ?? 0,
      savedCount: 0,
      timestamp: m.timestamp ?? "",
    }))

    const totalEngagement = posts.reduce((s, p) => s + p.likeCount + p.commentCount + p.savedCount, 0)
    const engagementRate = followers > 0 && posts.length > 0
      ? Number(((totalEngagement / posts.length / followers) * 100).toFixed(1))
      : 0

    return { followers, reach, profileViews, engagementRate, igUsername: account.username, posts, mock: false }
  } catch {
    return MOCK
  }
}
