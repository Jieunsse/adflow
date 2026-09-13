import { afterEach, describe, expect, it, vi } from "vitest"
import { saveWorkspaceTarget } from "@shared/lib/workspace-meta-target-client"

afterEach(() => vi.restoreAllMocks())

describe("setup workspace target", () => {
  it("target PATCH 실패를 호출자에게 전달해요", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "forbidden" }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(saveWorkspaceTarget({ pageId: "page-1" })).rejects.toThrow("forbidden")
    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/meta-target", expect.objectContaining({ method: "PATCH" }))
  })
})
