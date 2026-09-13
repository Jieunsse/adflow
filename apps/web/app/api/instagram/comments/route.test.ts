import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getServerSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession }))
vi.mock("@/lib/meta-session", () => ({
  getWorkspaceSession: (session: unknown) => Promise.resolve(session),
}))

describe("GET /api/instagram/comments", () => {
  beforeEach(() => {
    getServerSession.mockResolvedValue({ igUserId: "ig_1", igAccessToken: "IGAAX_token" })
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    getServerSession.mockReset()
    fetchMock.mockReset()
  })

  it("실제 API의 빈 댓글 배열을 샘플로 바꾸지 않는다", async () => {
    const { GET } = await import("./route")
    const response = await GET(new NextRequest("http://localhost/api/instagram/comments?mediaId=media_1"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ ok: true, items: [] })
  })
})
