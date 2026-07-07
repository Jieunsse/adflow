import { describe, it, expect } from "vitest";
import { aggregateCampaignPerformance, applyPerformanceToHistory } from "./aggregate";
import type { CampaignEntry } from "@entities/influencer-campaign/model";
import type { Creator } from "./model";

function entry(overrides: Partial<CampaignEntry>): CampaignEntry {
  return {
    creatorId: "c-1",
    stage: "settled",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateCampaignPerformance", () => {
  it("revenue·cost 둘 다 있으면 roas 계산", () => {
    const entries = [
      entry({ performance: { campaignId: "camp-1", reach: 100, clicks: 10, conversions: 2, revenue: 200000, cost: 100000, recordedAt: "2026-07-01T00:00:00.000Z" } }),
    ];

    const result = aggregateCampaignPerformance(entries);

    expect(result.roas).toBe(2);
  });

  it("revenue 또는 cost 미입력이면 roas 는 undefined (0 아님)", () => {
    const entries = [
      entry({ performance: { campaignId: "camp-1", reach: 100, clicks: 10, conversions: 2, recordedAt: "2026-07-01T00:00:00.000Z" } }),
    ];

    const result = aggregateCampaignPerformance(entries);

    expect(result.roas).toBeUndefined();
  });

  it("performance 없는 entry 는 0 기여로 집계", () => {
    const entries = [entry({ performance: undefined })];

    const result = aggregateCampaignPerformance(entries);

    expect(result).toEqual({ reach: 0, clicks: 0, conversions: 0, revenue: undefined, cost: undefined, roas: undefined });
  });
});

describe("applyPerformanceToHistory", () => {
  const creator: Creator = {
    id: "c-1",
    handle: "@handle",
    platform: "instagram",
    category: [],
    performanceHistory: [
      { campaignId: "camp-old", reach: 500, conversions: 10, recordedAt: "2026-05-01T00:00:00.000Z" },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("새 캠페인 성과는 append", () => {
    const perf = { campaignId: "camp-new", reach: 1000, conversions: 50, recordedAt: "2026-07-01T00:00:00.000Z" };

    const updated = applyPerformanceToHistory(creator, "camp-new", perf);

    expect(updated.performanceHistory).toHaveLength(2);
    expect(updated.performanceHistory.map((p) => p.campaignId)).toEqual(["camp-old", "camp-new"]);
  });

  it("같은 campaignId 재입력은 append 아닌 교체", () => {
    const perf = { campaignId: "camp-old", reach: 999, conversions: 99, recordedAt: "2026-07-02T00:00:00.000Z" };

    const updated = applyPerformanceToHistory(creator, "camp-old", perf);

    expect(updated.performanceHistory).toHaveLength(1);
    expect(updated.performanceHistory[0]).toEqual(perf);
  });
});
