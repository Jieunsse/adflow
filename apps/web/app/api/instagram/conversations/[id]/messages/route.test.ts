import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getServerSession = vi.fn()
const saveIgMessages = vi.fn()
const fetchMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession }))
vi.mock("@/lib/meta-session", () => ({
  getWorkspaceSession: (session: unknown) => Promise.resolve(session),
}))
vi.mock("@/lib/ig-message-store", () => ({ saveIgMessages }))

describe("POST /api/instagram/conversations/[id]/messages", () => {
  beforeEach(() => {
    getServerSession.mockResolvedValue({ igUserId: "ig_1", igAccessToken: "IGAAX_token" })
    saveIgMessages.mockRejectedValue(new Error("cache unavailable"))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message_id: "mid_1" })))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    getServerSession.mockReset()
    saveIgMessages.mockReset()
    fetchMock.mockReset()
  })

  it("Meta 발송 성공은 캐시 저장 실패와 분리해 성공으로 반환한다", async () => {
    const { POST } = await import("./route")
    const request = new NextRequest("http://localhost/api/instagram/conversations/c1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: "person_1", text: "안녕하세요" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "c1" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ messageId: "mid_1" })
    expect(saveIgMessages).toHaveBeenCalledOnce()
  })
})
