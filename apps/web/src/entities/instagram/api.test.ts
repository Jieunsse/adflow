import { describe, expect, it, vi } from "vitest";
import { fetchInstagramInsights, instagramKeys } from "./api";

describe("instagram API", () => {
  it("인사이트 조회를 도메인 Query 계약으로 제공한다", async () => {
    const insights = { followers: 10, reach: 20, profileViews: 3, engagementRate: 1.2, posts: [], mock: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => insights }));

    await expect(fetchInstagramInsights()).resolves.toEqual(insights);
    expect(fetch).toHaveBeenCalledWith("/api/instagram/insights");
    expect(instagramKeys.insights).toEqual(["instagram", "insights"]);
    vi.unstubAllGlobals();
  });
});
