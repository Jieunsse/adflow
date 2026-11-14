import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { saveWorkspaceTarget } from "@shared/lib/workspace-meta-target-client"

const ls = new Map<string, string>()
function stubBrowser() {
  vi.stubGlobal("window", { dispatchEvent: () => true })
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => ls.get(k) ?? null,
    setItem: (k: string, v: string) => { ls.set(k, v) },
    removeItem: (k: string) => { ls.delete(k) },
    clear: () => { ls.clear() },
  })
}

beforeEach(() => {
  ls.clear()
  stubBrowser()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// 연결 대상은 지금 고른 브랜드의 연결이다 (기능 10).
describe("연결 대상 저장", () => {
  it("브랜드를 고르지 않았으면 저장하지 않아요", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(saveWorkspaceTarget({ pageId: "page-1" })).rejects.toThrow("브랜드를 먼저 골라 주세요.")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("서버가 거절한 이유를 호출자에게 전달해요", async () => {
    localStorage.setItem("adflow:brand-profile:active-id", "bp_1")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, redirected: false, json: async () => ({ adAccountId: "act_1" }) })
      .mockResolvedValueOnce({ ok: false, status: 409, redirected: false, json: async () => ({ error: "이 광고 계정은 이미 다른 브랜드에 연결돼 있어요." }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(saveWorkspaceTarget({ pageId: "page-1" })).rejects.toThrow("이 광고 계정은 이미 다른 브랜드에 연결돼 있어요.")
    expect(fetchMock).toHaveBeenLastCalledWith("/api/brands/bp_1/connection", expect.objectContaining({ method: "PUT" }))
  })
})
