const GRAPH = "https://graph.facebook.com/v20.0"

export type FbPost = {
  id: string
  mediaUrl: string
  caption: string
  reactionsCount: number
  commentsCount: number
  sharesCount: number
  timestamp: string
}

export type FbPageInsights = {
  followers: number          // /{page-id}?fields=followers_count
  postCount28d: number       // 최근 28일 게시물 수
  avgReactions: number       // (reactions + comments + shares) 평균
  engagementRate: number     // (총 반응 / 게시물 수 / 팔로워) × 100
  pageName?: string
  pageUsername?: string
  posts: FbPost[]            // 최근 5개
  mock: boolean
}

export const FB_MOCK_GOOD: FbPageInsights = {
  followers: 3800,
  postCount28d: 12,
  avgReactions: 145,
  engagementRate: 3.8,
  pageName: "Brand A",
  pageUsername: "brand.a",
  mock: true,
  posts: [
    { id: "fg1", mediaUrl: "", caption: "이번 주말 한정 프로모션 시작!", reactionsCount: 218, commentsCount: 34, sharesCount: 27, timestamp: "2026-05-10T09:00:00Z" },
    { id: "fg2", mediaUrl: "", caption: "오프라인 매장 라이브 — 신제품 첫 공개", reactionsCount: 412, commentsCount: 89, sharesCount: 56, timestamp: "2026-05-07T11:30:00Z" },
    { id: "fg3", mediaUrl: "", caption: "고객 후기 모음 (5월)", reactionsCount: 167, commentsCount: 23, sharesCount: 19, timestamp: "2026-05-03T14:00:00Z" },
    { id: "fg4", mediaUrl: "", caption: "브랜드 스토리 — 창업 비하인드", reactionsCount: 298, commentsCount: 47, sharesCount: 38, timestamp: "2026-04-28T10:00:00Z" },
    { id: "fg5", mediaUrl: "", caption: "팔로워 Q&A 라이브 다시보기", reactionsCount: 184, commentsCount: 52, sharesCount: 21, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

export const FB_MOCK_POOR: FbPageInsights = {
  followers: 1200,
  postCount28d: 3,
  avgReactions: 11,
  engagementRate: 0.9,
  pageName: "Brand A",
  pageUsername: "brand.a",
  mock: true,
  posts: [
    { id: "fp1", mediaUrl: "", caption: "신제품 안내", reactionsCount: 14, commentsCount: 1, sharesCount: 0, timestamp: "2026-05-10T09:00:00Z" },
    { id: "fp2", mediaUrl: "", caption: "공지사항", reactionsCount: 8, commentsCount: 0, sharesCount: 0, timestamp: "2026-05-07T11:30:00Z" },
    { id: "fp3", mediaUrl: "", caption: "이벤트 안내", reactionsCount: 12, commentsCount: 2, sharesCount: 1, timestamp: "2026-05-03T14:00:00Z" },
    { id: "fp4", mediaUrl: "", caption: "브랜드 소개", reactionsCount: 7, commentsCount: 0, sharesCount: 0, timestamp: "2026-04-28T10:00:00Z" },
    { id: "fp5", mediaUrl: "", caption: "5월 프로모션", reactionsCount: 10, commentsCount: 1, sharesCount: 0, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

const DAY_MS = 24 * 60 * 60 * 1000

async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`)
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

export async function getFacebookInsights(
  pageId: string | undefined,
  userToken: string | undefined,
): Promise<FbPageInsights> {
  if (!pageId || !userToken) return FB_MOCK_GOOD
  try {
    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return FB_MOCK_GOOD

    const [pageRes, postsRes] = await Promise.all([
      fetch(`${GRAPH}/${pageId}?fields=followers_count,name,username&access_token=${pageToken}`),
      fetch(`${GRAPH}/${pageId}/posts?fields=id,message,full_picture,reactions.summary(total_count),comments.summary(total_count),shares,created_time&limit=25&access_token=${pageToken}`),
    ])

    // page 가 실패하면 FB 페이지 식별 자체가 안 된 거라 mock 으로 떨어뜨림. posts 만 실패는 부분 데이터 유지 (followers·name 은 실데이터).
    if (!pageRes.ok) return FB_MOCK_GOOD

    const pageData = await pageRes.json() as {
      followers_count?: number; name?: string; username?: string
    }
    const postsData = await postsRes.json() as {
      data?: Array<{
        id: string
        message?: string
        full_picture?: string
        reactions?: { summary?: { total_count?: number } }
        comments?: { summary?: { total_count?: number } }
        shares?: { count?: number }
        created_time?: string
      }>
    }

    const allPosts = postsData.data ?? []

    // 최근 28일 게시물 카운트
    const now = Date.now()
    const since = now - 28 * DAY_MS
    const recent28d = allPosts.filter(p => {
      const t = p.created_time ? new Date(p.created_time).getTime() : 0
      return t >= since
    })

    const followers = pageData.followers_count ?? 0
    const postCount28d = recent28d.length

    const totalReactions = recent28d.reduce((s, p) => {
      const r = p.reactions?.summary?.total_count ?? 0
      const c = p.comments?.summary?.total_count ?? 0
      const sh = p.shares?.count ?? 0
      return s + r + c + sh
    }, 0)

    const avgReactions = postCount28d > 0 ? Math.round(totalReactions / postCount28d) : 0
    const engagementRate = followers > 0 && postCount28d > 0
      ? Number(((totalReactions / postCount28d / followers) * 100).toFixed(1))
      : 0

    const posts: FbPost[] = allPosts.slice(0, 5).map(p => ({
      id: p.id,
      mediaUrl: p.full_picture ?? "",
      caption: p.message ?? "",
      reactionsCount: p.reactions?.summary?.total_count ?? 0,
      commentsCount: p.comments?.summary?.total_count ?? 0,
      sharesCount: p.shares?.count ?? 0,
      timestamp: p.created_time ?? "",
    }))

    return {
      followers,
      postCount28d,
      avgReactions,
      engagementRate,
      pageName: pageData.name,
      pageUsername: pageData.username,
      posts,
      mock: false,
    }
  } catch {
    return FB_MOCK_GOOD
  }
}
