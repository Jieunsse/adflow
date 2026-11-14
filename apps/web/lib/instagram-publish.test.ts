import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { publishPhoto } from "./instagram-publish"

const fetchMock = vi.fn()
const session = { igUserId: "ig_1", igAccessToken: "IGAAX_token" }

function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe("publishPhoto", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it("공개 이미지 URL이 아니면 API를 호출하지 않는다", async () => {
    const result = await publishPhoto({ ...session, imageUrl: "file:///tmp/photo.jpg", caption: "" })
    expect(result).toEqual({ ok: false, error: "imageUrl 은 http(s) 로 시작하는 공개 URL 이어야 해요." })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("container 생성 실패의 상태와 본문을 반환한다", async () => {
    const body = { error: { message: "Invalid image URL", code: 100 } }
    fetchMock.mockResolvedValueOnce(response(body, 400))

    const result = await publishPhoto({ ...session, imageUrl: "https://example.com/photo.jpg", caption: "테스트" })

    expect(result).toMatchObject({ ok: false, status: 400, body, error: "Invalid image URL" })
  })

  it("container 생성 후 publish 실패의 상태와 본문을 반환한다", async () => {
    const body = { error: { message: "Publish denied", code: 10 } }
    fetchMock
      .mockResolvedValueOnce(response({ id: "container_1" }))
      .mockResolvedValueOnce(response({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(response(body, 403))

    const resultPromise = publishPhoto({ ...session, imageUrl: "https://example.com/photo.jpg", caption: "테스트" })
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toMatchObject({ ok: false, status: 403, body, error: "Publish denied" })
  })
})
