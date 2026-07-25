import { describe, it, expect } from "vitest";
import { rankCreators } from "./ranking";
import type { Creator } from "./model";
import type { InfluencerCampaign } from "@entities/influencer-campaign/model";

const baseCampaign: InfluencerCampaign = {
  id: "camp-1",
  name: "여름 뷰티 캠페인",
  goal: "뷰티 신제품 인지도",
  brandProfileId: "bp-1",
  entries: [],
  createdAt: "2026-07-01T00:00:00.000Z",
};

function creator(overrides: Partial<Creator>): Creator {
  return {
    id: "c-default",
    handle: "@default",
    platform: "instagram",
    category: [],
    performanceHistory: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("rankCreators", () => {
  it("실적 좋은 크리에이터가 실적 없는 크리에이터보다 상위", () => {
    const good = creator({
      id: "good",
      category: ["뷰티"],
      performanceHistory: [
        { campaignId: "prev-1", reach: 1000, conversions: 100, recordedAt: "2026-06-01T00:00:00.000Z" },
      ],
    });
    const cold = creator({ id: "cold", category: ["뷰티"] });

    const results = rankCreators([good, cold], baseCampaign);

    expect(results[0].creator.id).toBe("good");
    expect(results[0].reasons).toContain("지난 캠페인 전환 상위");
  });

  it("콜드 스타트: 이력 없는 크리에이터는 '협업 이력 없음' 근거를 갖고 카테고리로만 정렬", () => {
    const matching = creator({ id: "matching", category: ["뷰티"] });
    const nonMatching = creator({ id: "non-matching", category: ["푸드"] });

    const results = rankCreators([matching, nonMatching], baseCampaign);

    expect(results[0].creator.id).toBe("matching");
    expect(results.every((r) => r.reasons.includes("협업 이력 없음"))).toBe(true);
  });

  it("결정적: 동일 입력이면 여러 번 호출해도 동일 순서", () => {
    const creators = [
      creator({ id: "a", category: ["뷰티"], followerCount: 5000 }),
      creator({ id: "b", category: ["푸드"], followerCount: 50000 }),
    ];

    const r1 = rankCreators(creators, baseCampaign).map((r) => r.creator.id);
    const r2 = rankCreators(creators, baseCampaign).map((r) => r.creator.id);

    expect(r1).toEqual(r2);
  });
});
