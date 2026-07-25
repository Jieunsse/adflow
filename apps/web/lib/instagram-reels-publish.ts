import { GRAPH, IG_GRAPH, getPageToken, getIgUserId } from "./instagram-graph"

const REEL_STATUS_POLL_INTERVAL_MS = 3000
const REEL_STATUS_POLL_MAX = 40

export type ReelPublishInput = {
  videoUrl: string
  caption: string
  coverUrl?: string
  shareToFeed: boolean
}

export type ReelPublishSession = {
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}

export type ReelPublishResult =
  | { ok: true; mediaId: string; permalink?: string; mock?: boolean }
  | { ok: false; error: string; status?: number }

// Page token 경유 IG id/token 해석. igAccessToken 이 있으면 그대로 쓰고, 없을 때만 호출.
async function resolveIgCreds(opts: {
  igUserId?: string
  igAccessToken?: string
  pageId?: string
  accessToken?: string
}): Promise<{ igUserId: string; token: string; graphBase: string } | null> {
  if (opts.igUserId && opts.igAccessToken) {
    return { igUserId: opts.igUserId, token: opts.igAccessToken, graphBase: IG_GRAPH }
  }
  if (!opts.pageId || !opts.accessToken) return null
  const pageToken = await getPageToken(opts.pageId, opts.accessToken)
  if (!pageToken) return null
  const igUserId = opts.igUserId || (await getIgUserId(opts.pageId, pageToken))
  if (!igUserId) return null
  return { igUserId, token: pageToken, graphBase: GRAPH }
}

// 릴스는 인코딩 지연이 있어 3초 간격 × 40회(최대 2분) 폴링. ponytail: 2분 캡, 장기 인코딩은 재시도 안내로 커버
async function waitForReelContainer(containerId: string, token: string, graphBase: string): Promise<{ ready: boolean; status: string }> {
  for (let i = 0; i < REEL_STATUS_POLL_MAX; i++) {
    const res = await fetch(`${graphBase}/${containerId}?fields=status_code&access_token=${token}`)
    if (!res.ok) return { ready: false, status: "fetch_failed" }
    const data = await res.json() as { status_code?: string }
    const status = data.status_code ?? "UNKNOWN"
    if (status === "FINISHED") return { ready: true, status }
    if (status === "ERROR" || status === "EXPIRED") return { ready: false, status }
    await new Promise((r) => setTimeout(r, REEL_STATUS_POLL_INTERVAL_MS))
  }
  return { ready: false, status: "TIMEOUT" }
}

export async function publishReel(
  session: ReelPublishSession,
  input: ReelPublishInput
): Promise<ReelPublishResult> {
  const creds = await resolveIgCreds(session)
  if (!creds) return { ok: false, error: "Instagram 계정이 연결되지 않았어요. /connect 에서 먼저 IG 를 연결해 주세요." }

  const { igUserId, token, graphBase } = creds

  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: String(input.shareToFeed),
    access_token: token,
  })
  if (input.coverUrl) containerParams.set("cover_url", input.coverUrl)

  const containerRes = await fetch(`${graphBase}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: containerParams,
  })
  const containerBody = await containerRes.json() as { id?: string; error?: { message?: string } }
  if (!containerRes.ok || !containerBody.id) {
    return {
      ok: false,
      status: containerRes.status,
      error: containerBody.error?.message ?? "media container 생성 실패",
    }
  }

  const ready = await waitForReelContainer(containerBody.id, token, graphBase)
  if (!ready.ready) {
    return { ok: false, error: `container 준비 실패 (${ready.status})` }
  }

  const publishRes = await fetch(`${graphBase}/${igUserId}/media_publish`, {
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
    const linkRes = await fetch(`${graphBase}/${publishBody.id}?fields=permalink&access_token=${token}`)
    if (linkRes.ok) {
      const linkBody = await linkRes.json() as { permalink?: string }
      permalink = linkBody.permalink
    }
  } catch { /* permalink 없어도 게시는 성공 */ }

  return { ok: true, mediaId: publishBody.id, permalink }
}
