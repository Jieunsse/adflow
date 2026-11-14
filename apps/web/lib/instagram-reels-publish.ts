import {
  MetaGraphError,
  graphErrorMessage,
  graphStatus,
  hasGraphError,
  readGraphBody,
  resolveInstagramCredentials,
} from "./instagram-graph"

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
  | { ok: false; error: string; status?: number; body?: unknown }

// 릴스는 인코딩 지연이 있어 3초 간격 × 40회(최대 2분) 폴링. ponytail: 2분 캡, 장기 인코딩은 재시도 안내로 커버
async function waitForReelContainer(containerId: string, token: string, graphBase: string): Promise<{ ready: boolean; status: string; statusCode?: number; body?: unknown }> {
  for (let i = 0; i < REEL_STATUS_POLL_MAX; i++) {
    const res = await fetch(`${graphBase}/${containerId}?fields=status_code&access_token=${token}`, { cache: "no-store" })
    const data = await readGraphBody(res) as { status_code?: string; error?: { message?: string } }
    if (!res.ok || hasGraphError(data)) return { ready: false, status: "fetch_failed", statusCode: graphStatus(res.status, data), body: data }
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
  if (!/^https?:\/\/\S+$/i.test(input.videoUrl.trim())) {
    return { ok: false, error: "videoUrl 은 http(s) 로 시작하는 공개 URL 이어야 해요." }
  }
  if (input.caption.length > 2200) return { ok: false, error: "캡션은 2200자 이하여야 합니다." }
  if (input.coverUrl && !/^https?:\/\/\S+$/i.test(input.coverUrl.trim())) {
    return { ok: false, error: "coverUrl 은 http(s) 로 시작하는 공개 URL 이어야 해요." }
  }

  try {
    const creds = await resolveInstagramCredentials(session)
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
    const containerBody = await readGraphBody(containerRes) as { id?: string; error?: { message?: string } }
    if (!containerRes.ok || !containerBody.id) {
      return { ok: false, status: graphStatus(containerRes.status, containerBody), error: graphErrorMessage(containerBody, "media container 생성 실패"), body: containerBody }
    }

  const ready = await waitForReelContainer(containerBody.id, token, graphBase)
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

    return { ok: true, mediaId: publishBody.id, permalink }
  } catch (error) {
    if (error instanceof MetaGraphError) return { ok: false, error: error.message, status: error.status, body: error.body }
    return { ok: false, error: error instanceof Error ? error.message : "Instagram 릴스 게시 실패", status: 502 }
  }
}
