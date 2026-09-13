import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getWorkspaceMetaTarget, getWorkspaceMetaTargetAudit, updateWorkspaceMetaTarget } from "./workspace-meta-target"

let target: Record<string, string> = {}
let audit: unknown[] = []

beforeEach(() => {
  target = {}
  audit = []
  process.env.ADFLOW_BACKEND_URL = "http://backend"
  process.env.ADFLOW_INTERNAL_SECRET = "secret"
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    if (url.pathname.endsWith("/audit")) return new Response(JSON.stringify(audit), { status: 200 })
    if (init?.method === "PATCH") {
      const before = { ...target }
      Object.assign(target, JSON.parse(String(init.body)))
      audit.push({ actor: url.searchParams.get("actor"), timestamp: "2026-01-01T00:00:00Z", before, after: { ...target } })
    }
    return new Response(JSON.stringify({ target }), { status: 200 })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.ADFLOW_BACKEND_URL
  delete process.env.ADFLOW_INTERNAL_SECRET
})

describe("workspace meta target", () => {
  it("변경값과 이전·이후 변경 이력을 함께 저장해요", async () => {
    await updateWorkspaceMetaTarget({ adAccountId: "act_1", adAccountName: "첫 계정" }, "alice")
    await updateWorkspaceMetaTarget({ pixelId: "pixel_1", pixelName: "전환 Pixel" }, "bob")

    await expect(getWorkspaceMetaTarget()).resolves.toMatchObject({ adAccountId: "act_1", pixelId: "pixel_1" })
    await expect(getWorkspaceMetaTargetAudit()).resolves.toMatchObject([
      { actor: "alice", before: {}, after: { adAccountId: "act_1" } },
      { actor: "bob", before: { adAccountId: "act_1" }, after: { pixelId: "pixel_1" } },
    ])
  })
})
