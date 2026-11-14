import { afterEach, describe, expect, it, vi } from "vitest"
import { MetaGraphError } from "./instagram-graph"
import { sendInstagramMessage } from "./instagram-messages"

const fetchMock = vi.fn()

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe("sendInstagramMessage", () => {
  it("Instagram Login 토큰을 Authorization header로 전달한다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message_id: "mid_1" })))
    vi.stubGlobal("fetch", fetchMock)

    await expect(sendInstagramMessage("person_1", "안녕하세요", undefined, undefined, "ig_1", "IGAAX_token"))
      .resolves.toEqual({ messageId: "mid_1" })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://graph.instagram.com/ig_1/messages")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer IGAAX_token")
    expect(init.body).toBe(JSON.stringify({ recipient: { id: "person_1" }, message: { text: "안녕하세요" } }))
  })

  it("Facebook Login은 Page token과 graph.facebook.com fallback을 사용한다", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "page_token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ instagram_business_account: { id: "ig_fallback" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message_id: "mid_2" })))
    vi.stubGlobal("fetch", fetchMock)

    await expect(sendInstagramMessage("person_2", "답장", "page_1", "fb_user_token"))
      .resolves.toEqual({ messageId: "mid_2" })

    const [url, init] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(url).toBe("https://graph.facebook.com/v20.0/ig_fallback/messages")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer page_token")
  })

  it("실제 Graph API 오류의 상태와 본문을 보존한다", async () => {
    const body = { error: { message: "Permission denied", code: 10 } }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 403 }))
    vi.stubGlobal("fetch", fetchMock)

    const error = await sendInstagramMessage("person_3", "실패", undefined, undefined, "ig_1", "IGAAX_token")
      .catch((value: unknown) => value)

    expect(error).toBeInstanceOf(MetaGraphError)
    expect(error).toMatchObject({ status: 403, body })
  })
})
