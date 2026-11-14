import { GRAPH, MetaGraphError, getPageToken, graphErrorMessage, graphStatus, hasGraphError, readGraphBody } from "./instagram-graph"

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
  pageName: "그린루틴",
  pageUsername: "greenroutine.official",
  mock: true,
  posts: [
    { id: "fg1", mediaUrl: "/demo/library/cream.jpg", caption: "비건 수분 크림 리필 기획전 🌿", reactionsCount: 218, commentsCount: 34, sharesCount: 27, timestamp: "2026-05-10T09:00:00Z" },
    { id: "fg2", mediaUrl: "/demo/library/toner.jpg", caption: "무향·무색소 비건 토너 라이브 첫 공개", reactionsCount: 412, commentsCount: 89, sharesCount: 56, timestamp: "2026-05-07T11:30:00Z" },
    { id: "fg3", mediaUrl: "/demo/library/serum.jpg", caption: "고객 후기 모음 (5월) — 식물성 세럼", reactionsCount: 167, commentsCount: 23, sharesCount: 19, timestamp: "2026-05-03T14:00:00Z" },
    { id: "fg4", mediaUrl: "/demo/library/pack.jpg", caption: "브랜드 스토리 — 비건 스킨케어를 시작한 이유", reactionsCount: 298, commentsCount: 47, sharesCount: 38, timestamp: "2026-04-28T10:00:00Z" },
    { id: "fg5", mediaUrl: "/demo/library/pad.jpg", caption: "민감성 피부 Q&A 라이브 다시보기", reactionsCount: 184, commentsCount: 52, sharesCount: 21, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

export const FB_MOCK_POOR: FbPageInsights = {
  followers: 1200,
  postCount28d: 3,
  avgReactions: 11,
  engagementRate: 0.9,
  pageName: "그린루틴",
  pageUsername: "greenroutine.official",
  mock: true,
  posts: [
    { id: "fp1", mediaUrl: "/demo/library/toner.jpg", caption: "비건 토너 신제품 안내", reactionsCount: 14, commentsCount: 1, sharesCount: 0, timestamp: "2026-05-10T09:00:00Z" },
    { id: "fp2", mediaUrl: "/demo/library/cleanser.jpg", caption: "배송 일정 공지", reactionsCount: 8, commentsCount: 0, sharesCount: 0, timestamp: "2026-05-07T11:30:00Z" },
    { id: "fp3", mediaUrl: "/demo/library/pack.jpg", caption: "시트 팩 리필 이벤트 안내", reactionsCount: 12, commentsCount: 2, sharesCount: 1, timestamp: "2026-05-03T14:00:00Z" },
    { id: "fp4", mediaUrl: "/demo/library/serum.jpg", caption: "그린루틴 브랜드 소개", reactionsCount: 7, commentsCount: 0, sharesCount: 0, timestamp: "2026-04-28T10:00:00Z" },
    { id: "fp5", mediaUrl: "/demo/library/cream.jpg", caption: "5월 수분 크림 프로모션", reactionsCount: 10, commentsCount: 1, sharesCount: 0, timestamp: "2026-04-22T13:00:00Z" },
  ],
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function getFacebookInsights(
  pageId: string | undefined,
  userToken: string | undefined,
): Promise<FbPageInsights> {
  if (!pageId || !userToken) throw new MetaGraphError("Facebook 페이지가 연결되지 않았어요.", 401, { code: "missing_credentials" })
  const pageToken = await getPageToken(pageId, userToken)
  if (!pageToken) throw new MetaGraphError("Facebook Page token을 확인할 수 없어요.", 502, { code: "missing_page_token" })

  const [pageRes, postsRes] = await Promise.all([
      fetch(`${GRAPH}/${pageId}?fields=followers_count,name,username&access_token=${pageToken}`, { cache: "no-store" }),
      fetch(`${GRAPH}/${pageId}/posts?fields=id,message,full_picture,reactions.summary(total_count),comments.summary(total_count),shares,created_time&limit=25&access_token=${pageToken}`, { cache: "no-store" }),
  ])
  const pageData = await readGraphBody(pageRes) as {
    followers_count?: number; name?: string; username?: string; error?: { message?: string }
  }
  const postsData = await readGraphBody(postsRes) as {
    data?: Array<{
      id: string
      message?: string
      full_picture?: string
      reactions?: { summary?: { total_count?: number } }
      comments?: { summary?: { total_count?: number } }
      shares?: { count?: number }
      created_time?: string
    }>
    error?: { message?: string }
  }

  if (!pageRes.ok || hasGraphError(pageData)) {
    throw new MetaGraphError(graphErrorMessage(pageData, "Facebook 페이지 조회 실패"), graphStatus(pageRes.status, pageData), pageData)
  }
  if (!postsRes.ok || hasGraphError(postsData)) {
    throw new MetaGraphError(graphErrorMessage(postsData, "Facebook 게시물 조회 실패"), graphStatus(postsRes.status, postsData), postsData)
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
}
