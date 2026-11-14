import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession }))
vi.mock("@/lib/meta-session", () => ({
  getWorkspaceSession: (session: unknown) => Promise.resolve(session),
}))

describe("GET /api/instagram/verify-permissions", () => {
  beforeEach(() => {
    getServerSession.mockResolvedValue({
      igAccessToken: "IGAAX_token",
      igUserId: "ig_1",
    })
    fetchMock.mockImplementation((input: string) => {
      if (input.includes("/insights?")) return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      if (input.includes("/conversations?")) return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      if (input.includes("/comments?")) return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      if (input.includes("/media?")) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: "media_1" }] })))
      if (input.includes("/permissions?")) {
        return Promise.resolve(new Response(JSON.stringify({
          data: [
            { permission: "instagram_business_content_publish", status: "granted" },
            { permission: "instagram_business_manage_messages", status: "granted" },
          ],
        })))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    getServerSession.mockReset()
  })

  it("권한 확인 GET은 media container 생성 POST를 하지 않는다", async () => {
    const { GET } = await import("./route")
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.summary.instagram_business_content_publish).toBe("OK")
    expect(fetchMock.mock.calls.every(([, init]) => !init || init.method === undefined || init.method === "GET")).toBe(true)
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("picsum.photos"))).toBe(false)
  })
})
