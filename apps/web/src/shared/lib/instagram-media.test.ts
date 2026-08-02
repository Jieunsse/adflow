import { describe, expect, it, vi } from "vitest";
import { fetchIgMedia } from "./instagram-media";

describe("fetchIgMedia", () => {
  it("IG Media 응답의 누락된 선택 필드를 canonical 값으로 정규화한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        mock: false,
        items: [{ id: "media-1", mediaUrl: "https://image", caption: "", timestamp: "", likeCount: undefined }],
      }),
    }));

    await expect(fetchIgMedia(20)).resolves.toEqual({
      mock: false,
      items: [{ id: "media-1", mediaUrl: "https://image", caption: "", timestamp: "", likeCount: 0 }],
    });
    expect(fetch).toHaveBeenCalledWith("/api/instagram/recent-media?limit=20", { cache: "no-store" });
    vi.unstubAllGlobals();
  });

  it("실패 응답은 모든 호출부에 같은 오류를 전달한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "계정을 연결해 주세요" }),
    }));

    await expect(fetchIgMedia()).rejects.toThrow("계정을 연결해 주세요");
    vi.unstubAllGlobals();
  });
});
