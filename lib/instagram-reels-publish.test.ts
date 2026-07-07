import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { publishReel } from "./instagram-reels-publish"

const fetchMock = vi.fn()

function jsonResponse(body: object, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const BASE_SESSION = {
  igUserId: "ig_123",
  igAccessToken: "IGAAX_test_token",
}

const BASE_INPUT = {
  videoUrl: "https://example.com/video.mp4",
  caption: "테스트 릴스",
  shareToFeed: true,
}

describe("publishReel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it("container→FINISHED→publish→permalink 성공 경로면 ok:true 를 반환한다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse({ id: "media_1" }))
      .mockResolvedValueOnce(jsonResponse({ permalink: "https://www.instagram.com/reel/media_1/" }))

    const resultPromise = publishReel(BASE_SESSION, BASE_INPUT)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mediaId).toBe("media_1")
    expect(result.permalink).toBe("https://www.instagram.com/reel/media_1/")
  })

  it("container 생성 요청에 media_type=REELS 와 video_url 이 포함된다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse({ id: "media_1" }))
      .mockResolvedValueOnce(jsonResponse({ permalink: "https://www.instagram.com/reel/media_1/" }))

    const resultPromise = publishReel(BASE_SESSION, BASE_INPUT)
    await vi.runAllTimersAsync()
    await resultPromise

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain("/ig_123/media")
    const body = opts.body as URLSearchParams
    expect(body.get("media_type")).toBe("REELS")
    expect(body.get("video_url")).toBe(BASE_INPUT.videoUrl)
  })

  it("container 상태가 ERROR 면 즉시 ok:false 를 반환한다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: "ERROR" }))

    const resultPromise = publishReel(BASE_SESSION, BASE_INPUT)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("ERROR")
    // ERROR 는 즉시 반환되어야 하므로 media_publish 호출이 없어야 한다
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("폴링이 계속 IN_PROGRESS 면 타임아웃으로 ok:false 를 반환한다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "container_1" }))
      .mockResolvedValue(jsonResponse({ status_code: "IN_PROGRESS" }))

    const resultPromise = publishReel(BASE_SESSION, BASE_INPUT)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("TIMEOUT")
    // container 생성(1) + 폴링 40회 = 41 회 호출
    expect(fetchMock).toHaveBeenCalledTimes(41)
  })

  it("igAccessToken 도 pageId 도 없으면 ok:false 를 반환한다", async () => {
    const result = await publishReel({}, BASE_INPUT)

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
