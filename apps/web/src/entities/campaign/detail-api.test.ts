import { describe, expect, it, vi } from "vitest";
import { campaignDetailKeys, fetchCampaignInsights } from "./detail-api";

describe("campaign detail API", () => {
  it("성과 조회 URL과 Query Key에 기간·광고 범위를 반영한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ impressions: 10, clicks: 2, ctr: 20, spend: 100, daily: [] }),
    }));

    await fetchCampaignInsights("campaign-1", "7d", ["ad-a", "ad-b"]);

    expect(fetch).toHaveBeenCalledWith("/api/insights/campaign-1?period=7d&adIds=ad-a%2Cad-b");
    expect(campaignDetailKeys.insights("campaign-1", "7d", ["ad-a", "ad-b"])).toEqual([
      "campaign-insights", "campaign-1", "7d", "ad-a", "ad-b",
    ]);
    vi.unstubAllGlobals();
  });
});
