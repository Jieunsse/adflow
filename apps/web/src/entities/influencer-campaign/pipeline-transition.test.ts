import { describe, expect, it } from "vitest";
import type { Creator } from "@entities/creator/model";
import type { InfluencerCampaign } from "./model";
import { transitionCampaignEntry } from "./pipeline-transition";

const creator: Creator = {
  id: "creator-1",
  handle: "@minji",
  platform: "instagram",
  category: [],
  performanceHistory: [{
    campaignId: "campaign-1",
    reach: 1200,
    recordedAt: "2026-08-01T00:00:00.000Z",
  }],
  createdAt: "2026-07-01T00:00:00.000Z",
};

const campaign: InfluencerCampaign = {
  id: "campaign-1",
  name: "신제품 협업",
  goal: "인지도",
  brandProfileId: "brand-1",
  createdAt: "2026-07-01T00:00:00.000Z",
  entries: [{
    creatorId: "creator-1",
    stage: "settled",
    paidAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  }],
};

describe("transitionCampaignEntry", () => {
  it("정산에서 이전 단계로 돌아가면 해당 캠페인의 수동 성과 이력을 제거한다", () => {
    const result = transitionCampaignEntry({
      campaign,
      creator,
      creatorId: "creator-1",
      stage: "published",
      now: "2026-08-02T00:00:00.000Z",
    });

    expect(result.campaign.entries[0]).toMatchObject({ stage: "published" });
    expect(result.creator?.performanceHistory).toEqual([]);
  });
});
