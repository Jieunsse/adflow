import {
  MetaGraphError,
  graphErrorMessage,
  graphStatus,
  hasGraphError,
  readGraphBody,
  resolveInstagramCredentials,
} from "./instagram-graph"

const STATUS_POLL_INTERVAL_MS = 1500
const STATUS_POLL_MAX = 8

export type PublishResult =
  | { ok: true; postId: string; permalink?: string; mock?: boolean }
  | { ok: false; error: string; status?: number; body?: unknown }

export type RecentMediaItem = {
  id: string
  mediaUrl: string
  caption: string
  permalink?: string
  timestamp: string
  likeCount: number
}

export type RecentMediaResult =
  | { ok: true; items: RecentMediaItem[]; mock?: boolean }
  | { ok: false; error: string; status?: number; body?: unknown }

export const RECENT_MEDIA_MOCK: RecentMediaItem[] = [
  {
    id: "default",
    mediaUrl: "/demo/library/cream.jpg",
    caption: "새 비건 수분 크림 입고 🌿 식물성 성분만 담았어요",
    permalink: "https://www.instagram.com/p/mock-1/",
    timestamp: "2026-05-22T11:00:00Z",
    likeCount: 0,
  },
  {
    id: "mock-2",
    mediaUrl: "/demo/library/toner.jpg",
    caption: "무향·무색소 비건 토너 리필 기획전 — 프로필 링크에서 확인하기",
    permalink: "https://www.instagram.com/p/mock-2/",
    timestamp: "2026-05-21T15:30:00Z",
    likeCount: 0,
  },
  {
    id: "mock-3",
    mediaUrl: "/demo/library/serum.jpg",
    caption: "고객 후기 모아봤어요 💌 #그린루틴 #비건스킨케어",
    permalink: "https://www.instagram.com/p/mock-3/",
    timestamp: "2026-05-20T09:10:00Z",
    likeCount: 0,
  },
]

// container 상태가 FINISHED 될 때까지 폴링 (사진은 보통 1-2초).
async function waitForContainer(containerId: string, token: string, graphBase: string): Promise<{ ready: boolean; status: string; statusCode?: number; body?: unknown }> {
  for (let i = 0; i < STATUS_POLL_MAX; i++) {
    const res = await fetch(`${graphBase}/${containerId}?fields=status_code&access_token=${token}`, { cache: "no-store" })
    const data = await readGraphBody(res) as { status_code?: string }
    if (!res.ok || hasGraphError(data)) return { ready: false, status: "fetch_failed", statusCode: graphStatus(res.status, data), body: data }
    const status = data.status_code ?? "UNKNOWN"
    if (status === "FINISHED") return { ready: true, status }
    if (status === "ERROR" || status === "EXPIRED") return { ready: false, status }
    await new Promise((r) => setTimeout(r, STATUS_POLL_INTERVAL_MS))
  }
  return { ready: false, status: "TIMEOUT" }
}

export async function publishPhoto(opts: {
  imageUrl: string
  caption: string
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<PublishResult> {
  if (!/^https?:\/\/\S+$/i.test(opts.imageUrl.trim())) {
    return { ok: false, error: "imageUrl 은 http(s) 로 시작하는 공개 URL 이어야 해요." }
  }
  if (opts.caption.length > 2200) return { ok: false, error: "캡션은 2200자 이하여야 합니다." }

  try {
    const creds = await resolveInstagramCredentials(opts)
    if (!creds) return { ok: false, error: "Instagram 계정이 연결되지 않았어요. /connect 에서 먼저 IG 를 연결해 주세요." }
    const { igUserId, token, graphBase } = creds

    const containerRes = await fetch(`${graphBase}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        image_url: opts.imageUrl,
        caption: opts.caption,
        access_token: token,
      }),
    })
    const containerBody = await readGraphBody(containerRes) as { id?: string; error?: { message?: string } }
    if (!containerRes.ok || !containerBody.id) {
      return { ok: false, status: graphStatus(containerRes.status, containerBody), error: graphErrorMessage(containerBody, "media container 생성 실패"), body: containerBody }
    }

    const ready = await waitForContainer(containerBody.id, token, graphBase)
    if (!ready.ready) {
      return { ok: false, error: `container 준비 실패 (${ready.status})`, status: ready.statusCode, body: ready.body }
    }

    const publishRes = await fetch(`${graphBase}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerBody.id,
        access_token: token,
      }),
    })
    const publishBody = await readGraphBody(publishRes) as { id?: string; error?: { message?: string } }
    if (!publishRes.ok || !publishBody.id) {
      return { ok: false, status: graphStatus(publishRes.status, publishBody), error: graphErrorMessage(publishBody, "media_publish 실패"), body: publishBody }
    }

    let permalink: string | undefined
    try {
      const linkRes = await fetch(`${graphBase}/${publishBody.id}?fields=permalink&access_token=${token}`, { cache: "no-store" })
      if (linkRes.ok) {
        const linkBody = await readGraphBody(linkRes) as { permalink?: string }
        permalink = linkBody.permalink
      }
    } catch { /* permalink 없어도 게시는 성공 */ }

    return { ok: true, postId: publishBody.id, permalink }
  } catch (error) {
    if (error instanceof MetaGraphError) return { ok: false, error: error.message, status: error.status, body: error.body }
    return { ok: false, error: error instanceof Error ? error.message : "Instagram 게시 실패", status: 502 }
  }
}

export async function getRecentMedia(opts: {
  limit?: number
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<RecentMediaResult> {
  try {
    const creds = await resolveInstagramCredentials(opts)
    if (!creds) return { ok: false, error: "Instagram 계정이 연결되지 않았어요." }
    const limit = Math.min(Math.max(Math.floor(opts.limit ?? 5), 1), 50)
    const res = await fetch(
      `${creds.graphBase}/${creds.igUserId}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,like_count&limit=${limit}&access_token=${creds.token}`,
      { cache: "no-store" },
    )
    const body = await readGraphBody(res) as {
      data?: Array<{
        id: string; caption?: string; media_url?: string; thumbnail_url?: string
        permalink?: string; timestamp?: string; like_count?: number
      }>
      error?: { message?: string }
    }
    if (!res.ok || hasGraphError(body)) return { ok: false, status: graphStatus(res.status, body), error: graphErrorMessage(body, "최근 게시 조회 실패"), body }
    const items: RecentMediaItem[] = (body.data ?? []).map((m) => ({
      id: m.id,
      mediaUrl: m.thumbnail_url ?? m.media_url ?? "",
      caption: m.caption ?? "",
      permalink: m.permalink,
      timestamp: m.timestamp ?? "",
      likeCount: m.like_count ?? 0,
    }))
    return { ok: true, items }
  } catch (error) {
    if (error instanceof MetaGraphError) return { ok: false, error: error.message, status: error.status, body: error.body }
    return { ok: false, error: error instanceof Error ? error.message : "최근 게시 조회 실패", status: 502 }
  }
}
