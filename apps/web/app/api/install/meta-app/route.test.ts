import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tmpdir } from "node:os"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve(null)),
}))

const fetchMock = vi.fn()

let tmpDir: string

beforeEach(async () => {
  vi.resetModules()
  process.env.NEXTAUTH_SECRET = "test-secret-stable"
  tmpDir = await mkdtemp(path.join(tmpdir(), "adflow-route-"))
  process.env.ADFLOW_DATA_DIR = tmpDir
  delete process.env.META_CLIENT_ID
  delete process.env.META_CLIENT_SECRET
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(async () => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
})

function jsonResponse(body: object) {
  return { ok: true, json: async () => body }
}

function buildReq(body: object) {
  return new Request("http://x/api/install/meta-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/install/meta-app", () => {
  it("입력값이 비어있으면 400", async () => {
    const { POST } = await import("./route")
    const res = await POST(buildReq({}))
    expect(res.status).toBe(400)
  })

  it("clientSecret 만 있고 clientId 비어있으면 400", async () => {
    const { POST } = await import("./route")
    const res = await POST(buildReq({ clientSecret: "x" }))
    expect(res.status).toBe(400)
  })

  it("Meta 검증 통과 시 자격증명 저장 + 앱 이름 반환", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "app|123|abc" }))
      .mockResolvedValueOnce(jsonResponse({ name: "테스트 앱", namespace: "test_ns" }))

    const { POST } = await import("./route")
    const res = await POST(buildReq({ clientId: "1234567890", clientSecret: "secret123" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.app).toEqual({ name: "테스트 앱", namespace: "test_ns" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain("/oauth/access_token")
    expect(fetchMock.mock.calls[0][0]).toContain("client_id=1234567890")
    expect(fetchMock.mock.calls[0][0]).toContain("grant_type=client_credentials")
    expect(fetchMock.mock.calls[1][0]).toContain("/1234567890")
    expect(fetchMock.mock.calls[1][0]).toContain("fields=name%2Cnamespace")
  })

  it("Meta 토큰 발급 실패 시 400 + 에러 메시지", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Invalid app secret", code: 101 } }),
    )

    const { POST } = await import("./route")
    const res = await POST(buildReq({ clientId: "111", clientSecret: "bad" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Invalid app secret")
  })

  it("앱 정보 조회 실패 시 400 + 안내 메시지", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "ok" }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Unknown app", code: 803 } }))

    const { POST } = await import("./route")
    const res = await POST(buildReq({ clientId: "999", clientSecret: "ok" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Unknown app")
  })

  it("clientId/clientSecret 의 앞뒤 공백은 trim 후 검증", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "ok" }))
      .mockResolvedValueOnce(jsonResponse({ name: "Trimmed App", namespace: null }))

    const { POST } = await import("./route")
    const res = await POST(buildReq({ clientId: "  555  ", clientSecret: "  pw  " }))
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toContain("client_id=555")
    expect(fetchMock.mock.calls[0][0]).toContain("client_secret=pw")
  })
})

describe("GET /api/install/meta-app", () => {
  it("자격증명 없을 때 configured=false", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.configured).toBe(false)
    expect(data.clientId).toBeNull()
  })
})
