import { GRAPH, MetaGraphError, getPageToken, graphErrorMessage, graphStatus, hasGraphError, readGraphBody } from "./instagram-graph"

export type FbPagePost = {
  id: string
  message: string
  fullPicture?: string
  permalinkUrl?: string
  createdTime: string
  reactionsCount: number
  commentsCount: number
}

export type FbComment = {
  id: string
  fromName?: string
  fromPictureUrl?: string
  message: string
  createdTime: string
  likeCount: number
}

export type FbPagePostsResult = {
  posts: FbPagePost[]
  nextCursor?: string
  mock: boolean
}

export type FbPostCommentsResult = {
  comments: FbComment[]
  mock: boolean
}

export const FB_PAGE_POSTS_MOCK: FbPagePost[] = [
  {
    id: "mock-post-1",
    message: "이번 주말, 비건 수분 크림 리필 기획전을 열어요. 식물성 성분만 담아 민감한 피부도 편안하게 🌿",
    fullPicture: "/demo/library/cream.jpg",
    permalinkUrl: "https://facebook.com/mock/1",
    createdTime: "2026-05-23T09:00:00Z",
    reactionsCount: 218,
    commentsCount: 34,
  },
  {
    id: "mock-post-2",
    message: "무향·무색소 비건 토너 라이브 — 첫 공개를 함께해 주신 분들께 감사드려요.",
    fullPicture: "/demo/library/toner.jpg",
    permalinkUrl: "https://facebook.com/mock/2",
    createdTime: "2026-05-20T11:30:00Z",
    reactionsCount: 412,
    commentsCount: 89,
  },
  {
    id: "mock-post-3",
    message: "고객 후기 모음 (5월) — 식물성 세럼을 다시 찾아주신 분들의 진심 어린 후기예요. 감사합니다.",
    fullPicture: "/demo/library/serum.jpg",
    permalinkUrl: "https://facebook.com/mock/3",
    createdTime: "2026-05-15T14:00:00Z",
    reactionsCount: 167,
    commentsCount: 23,
  },
  {
    id: "mock-post-4",
    message: "브랜드 스토리 — 우리가 비건 스킨케어를 시작한 이유, 그 비하인드를 공개했어요.",
    fullPicture: "/demo/library/pack.jpg",
    permalinkUrl: "https://facebook.com/mock/4",
    createdTime: "2026-05-10T10:00:00Z",
    reactionsCount: 298,
    commentsCount: 47,
  },
  {
    id: "mock-post-5",
    message: "팔로워 Q&A 라이브 다시보기 — 민감성 피부 케어 질문에 답해드렸어요.",
    fullPicture: "/demo/library/pad.jpg",
    permalinkUrl: "https://facebook.com/mock/5",
    createdTime: "2026-05-04T13:00:00Z",
    reactionsCount: 184,
    commentsCount: 52,
  },
]

export const FB_COMMENTS_MOCK: FbComment[] = [
  { id: "mock-cm-1", fromName: "김민지", message: "수분 크림 진짜 순하고 좋아요! 리필도 나오나요?", createdTime: "2026-05-23T10:12:00Z", likeCount: 4 },
  { id: "mock-cm-2", fromName: "박서준", message: "비건인데 발림성 만족합니다 👍", createdTime: "2026-05-23T11:42:00Z", likeCount: 12 },
  { id: "mock-cm-3", fromName: "이수아", message: "무향이라 아침에 쓰기 부담 없네요. 온라인도 같은 혜택인가요?", createdTime: "2026-05-23T13:05:00Z", likeCount: 2 },
]

type RawPost = {
  id: string
  message?: string
  full_picture?: string
  permalink_url?: string
  created_time?: string
  reactions?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
}

export async function listPagePosts(
  pageId: string | undefined,
  userToken: string | undefined,
  cursor?: string,
): Promise<FbPagePostsResult> {
  if (!pageId || !userToken) throw new MetaGraphError("Facebook 페이지가 연결되지 않았어요.", 401, { code: "missing_credentials" })
  const pageToken = await getPageToken(pageId, userToken)
  if (!pageToken) throw new MetaGraphError("Facebook Page token을 확인할 수 없어요.", 502, { code: "missing_page_token" })
    const fields = "id,message,full_picture,permalink_url,created_time,reactions.summary(total_count),comments.summary(total_count)"
    const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ""
    const res = await fetch(`${GRAPH}/${pageId}/posts?fields=${fields}&limit=15${after}&access_token=${pageToken}`, { cache: "no-store" })
    const data = await readGraphBody(res) as { data?: RawPost[]; paging?: { cursors?: { after?: string }; next?: string }; error?: { message?: string } }
    if (!res.ok || hasGraphError(data)) throw new MetaGraphError(graphErrorMessage(data, "Facebook 게시물 조회 실패"), graphStatus(res.status, data), data)
    const raw = data.data ?? []
    const posts: FbPagePost[] = raw.map((p) => ({
      id: p.id,
      message: p.message ?? "",
      fullPicture: p.full_picture,
      permalinkUrl: p.permalink_url,
      createdTime: p.created_time ?? "",
      reactionsCount: p.reactions?.summary?.total_count ?? 0,
      commentsCount: p.comments?.summary?.total_count ?? 0,
    }))
    const nextCursor = data.paging?.next ? data.paging.cursors?.after : undefined
    return { posts, nextCursor, mock: false }
}

type RawComment = {
  id: string
  from?: { name?: string; picture?: { data?: { url?: string } } }
  message?: string
  created_time?: string
  like_count?: number
}

export async function listPostComments(
  postId: string,
  pageId: string | undefined,
  userToken: string | undefined,
): Promise<FbPostCommentsResult> {
  if (!pageId || !userToken) throw new MetaGraphError("Facebook 페이지가 연결되지 않았어요.", 401, { code: "missing_credentials" })
  const pageToken = await getPageToken(pageId, userToken)
  if (!pageToken) throw new MetaGraphError("Facebook Page token을 확인할 수 없어요.", 502, { code: "missing_page_token" })
    const fields = "id,from{name,picture{url}},message,created_time,like_count"
    const res = await fetch(`${GRAPH}/${postId}/comments?fields=${fields}&limit=25&access_token=${pageToken}`, { cache: "no-store" })
    const data = await readGraphBody(res) as { data?: RawComment[]; error?: { message?: string } }
    if (!res.ok || hasGraphError(data)) throw new MetaGraphError(graphErrorMessage(data, "Facebook 댓글 조회 실패"), graphStatus(res.status, data), data)
    const raw = data.data ?? []
    const comments: FbComment[] = raw.map((c) => ({
      id: c.id,
      fromName: c.from?.name,
      fromPictureUrl: c.from?.picture?.data?.url,
      message: c.message ?? "",
      createdTime: c.created_time ?? "",
      likeCount: c.like_count ?? 0,
    }))
    return { comments, mock: false }
}
