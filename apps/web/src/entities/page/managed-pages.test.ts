import { describe, expect, it, vi } from "vitest";
import { fetchManagedPages, managedPagesQueryKey } from "./managed-pages";

describe("fetchManagedPages", () => {
  it("관리 페이지 목록을 읽는다", async () => {
    const result = { pages: [{ id: "page-1", name: "AdFlow" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => result }));

    await expect(fetchManagedPages()).resolves.toEqual(result);
    expect(managedPagesQueryKey).toEqual(["fb-pages"]);
    vi.unstubAllGlobals();
  });

  it("조회 실패를 호출부에 전달한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "권한 없음" }) }));

    await expect(fetchManagedPages()).rejects.toThrow("FB 페이지 목록을 불러오지 못했어요");
    vi.unstubAllGlobals();
  });
});
