import { describe, expect, it, vi } from "vitest";
import { fetchAdIdentityPages } from "./api";

describe("fetchAdIdentityPages", () => {
  it("광고 명의 Page 목록을 읽는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [{ id: "page-1", name: "AdFlow", phone: null, igUserId: "ig-1", igUsername: "adflow" }],
      }),
    }));

    await expect(fetchAdIdentityPages()).resolves.toEqual([
      { id: "page-1", name: "AdFlow", phone: null, igUserId: "ig-1", igUsername: "adflow" },
    ]);
    expect(fetch).toHaveBeenCalledWith("/api/setup/pages");
    vi.unstubAllGlobals();
  });

  it("조회 실패 사유를 호출부에 전달한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "페이지 권한이 없어요" }),
    }));

    await expect(fetchAdIdentityPages()).rejects.toThrow("페이지 권한이 없어요");
    vi.unstubAllGlobals();
  });
});
