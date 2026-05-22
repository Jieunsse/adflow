const GRAPH = "https://graph.facebook.com/v20.0"
const STATUS_POLL_INTERVAL_MS = 1500
const STATUS_POLL_MAX = 8

export type PublishResult =
  | { ok: true; postId: string; permalink?: string; mock?: boolean }
  | { ok: false; error: string; status?: number }

export type RecentMediaItem = {
  id: string
  mediaUrl: string
  caption: string
  permalink?: string
  timestamp: string
}

export type RecentMediaResult =
  | { ok: true; items: RecentMediaItem[]; mock?: boolean }
  | { ok: false; error: string; status?: number }

const RECENT_MEDIA_MOCK: RecentMediaItem[] = [
  {
    id: "default",
    mediaUrl: "https://picsum.photos/seed/adflow-1/200/200",
    caption: "신상품 입고 ✨ 5월 시즌룩 컬렉션 전체 보러가기",
    permalink: "https://www.instagram.com/p/mock-1/",
    timestamp: "2026-05-22T11:00:00Z",
  },
  {
    id: "mock-2",
    mediaUrl: "https://picsum.photos/seed/adflow-2/200/200",
    caption: "오늘만 20% 쿠폰 — 프로필 링크에서 받기",
    permalink: "https://www.instagram.com/p/mock-2/",
    timestamp: "2026-05-21T15:30:00Z",
  },
  {
    id: "mock-3",
    mediaUrl: "https://picsum.photos/seed/adflow-3/200/200",
    caption: "고객 후기 모아봤어요 💌 #adflow",
    permalink: "https://www.instagram.com/p/mock-3/",
    timestamp: "2026-05-20T09:10:00Z",
  },
]

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

// Page token 경유 IG id/token 해석. igAccessToken 이 있으면 그대로 쓰고, 없을 때만 호출.
async function resolveIgCreds(opts: {
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<{ igUserId: string; token: string } | null> {
  if (opts.igUserId && opts.igAccessToken) {
    return { igUserId: opts.igUserId, token: opts.igAccessToken }
  }
  if (!opts.pageId || !opts.accessToken) return null
  const pageToken = await getPageToken(opts.pageId, opts.accessToken)
  if (!pageToken) return null
  const igUserId = opts.igUserId || (await getIgUserId(opts.pageId, pageToken))
  if (!igUserId) return null
  return { igUserId, token: pageToken }
}

// container 상태가 FINISHED 될 때까지 폴링 (사진은 보통 1-2초).
async function waitForContainer(containerId: string, token: string): Promise<{ ready: boolean; status: string }> {
  for (let i = 0; i < STATUS_POLL_MAX; i++) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${token}`)
    if (!res.ok) return { ready: false, status: "fetch_failed" }
    const data = await res.json() as { status_code?: string }
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
  const creds = await resolveIgCreds(opts)
  if (!creds) return { ok: false, error: "Instagram 계정이 연결되지 않았어요. /connect 에서 먼저 IG 를 연결해 주세요." }

  const { igUserId, token } = creds

  const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: opts.imageUrl,
      caption: opts.caption,
      access_token: token,
    }),
  })
  const containerBody = await containerRes.json() as { id?: string; error?: { message?: string } }
  if (!containerRes.ok || !containerBody.id) {
    return {
      ok: false,
      status: containerRes.status,
      error: containerBody.error?.message ?? "media container 생성 실패",
    }
  }

  const ready = await waitForContainer(containerBody.id, token)
  if (!ready.ready) {
    return { ok: false, error: `container 준비 실패 (${ready.status})` }
  }

  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerBody.id,
      access_token: token,
    }),
  })
  const publishBody = await publishRes.json() as { id?: string; error?: { message?: string } }
  if (!publishRes.ok || !publishBody.id) {
    return {
      ok: false,
      status: publishRes.status,
      error: publishBody.error?.message ?? "media_publish 실패",
    }
  }

  let permalink: string | undefined
  try {
    const linkRes = await fetch(`${GRAPH}/${publishBody.id}?fields=permalink&access_token=${token}`)
    if (linkRes.ok) {
      const linkBody = await linkRes.json() as { permalink?: string }
      permalink = linkBody.permalink
    }
  } catch { /* permalink 없어도 게시는 성공 */ }

  return { ok: true, postId: publishBody.id, permalink }
}

export async function getRecentMedia(opts: {
  limit?: number
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<RecentMediaResult> {
  const creds = await resolveIgCreds(opts)
  if (!creds) return { ok: true, items: RECENT_MEDIA_MOCK, mock: true }
  const limit = opts.limit ?? 5
  const res = await fetch(
    `${GRAPH}/${creds.igUserId}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${creds.token}`
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return { ok: false, status: res.status, error: body.error?.message ?? "최근 게시 조회 실패" }
  }
  const body = await res.json() as {
    data?: Array<{
      id: string; caption?: string; media_url?: string; thumbnail_url?: string
      permalink?: string; timestamp?: string
    }>
  }
  const items: RecentMediaItem[] = (body.data ?? []).map((m) => ({
    id: m.id,
    mediaUrl: m.thumbnail_url ?? m.media_url ?? "",
    caption: m.caption ?? "",
    permalink: m.permalink,
    timestamp: m.timestamp ?? "",
  }))
  return { ok: true, items }
}
