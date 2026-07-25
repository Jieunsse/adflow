"use client";

// ADR-065 §9, PRD-influencer-marketing.md §9 — Browse Mode 시연 시드. campaign/browse/seed.ts(seedAutoPilotDemo) 대칭.
// 완료(정산) 인플루언서 캠페인 1개 + 실적 차등 크리에이터 3명(전환 상위·중간·저성과)을 멱등 주입해
// rankCreators() 가 즉시 "지난 캠페인 전환 상위" 근거 칩을 내도록 피드백 루프를 데모에서 성립시킨다.
// 실유저 경로엔 절대 미주입(ADR-033) — 호출측(페이지)이 session.browseMode 로 게이트한다.

import type { Creator } from "../model";
import type { InfluencerCampaign, CampaignEntry } from "@entities/influencer-campaign/model";
import { upsertCreator, creatorsSnapshot } from "../store";
import { upsertInfluencerCampaign, influencerCampaignsSnapshot } from "@entities/influencer-campaign/store";

const DEMO_CAMPAIGN_ID = "browse_demo_influencer_campaign_moisture";
const DEMO_CREATOR_TOP_ID = "browse_demo_creator_top";
const DEMO_CREATOR_MID_ID = "browse_demo_creator_mid";
const DEMO_CREATOR_LOW_ID = "browse_demo_creator_low";
const DEMO_BRAND_PROFILE_ID = "demo-greenroutine-001"; // tournament/seed.ts 와 동일 데모 브랜드 — 랭킹 카테고리 컨텍스트 정렬.

const CREATED_AT = "2026-06-15T09:00:00+09:00";

function creatorSeed(
  id: string,
  handle: string,
  displayName: string,
  followerCount: number,
  performance: { reach: number; clicks: number; conversions: number; revenue: number; cost: number },
): Creator {
  return {
    id,
    handle,
    platform: "instagram",
    displayName,
    category: ["뷰티", "스킨케어"],
    followerCount,
    note: "browse 시연 크리에이터",
    performanceHistory: [
      {
        campaignId: DEMO_CAMPAIGN_ID,
        ...performance,
        recordedAt: "2026-06-30T18:00:00+09:00",
      },
    ],
    createdAt: CREATED_AT,
  };
}

// 전환율 = conversions / reach 기준: 상위 4.0% · 중간 1.5% · 저성과 0.3% — rankCreators 백분위가 뚜렷이 갈리도록.
const DEMO_CREATORS: Creator[] = [
  creatorSeed(DEMO_CREATOR_TOP_ID, "@glow_jiwoo", "지우", 42000, {
    reach: 38000,
    clicks: 2400,
    conversions: 1520,
    revenue: 9800000,
    cost: 800000,
  }),
  creatorSeed(DEMO_CREATOR_MID_ID, "@haru_skin", "하루", 15800, {
    reach: 12000,
    clicks: 540,
    conversions: 180,
    revenue: 2100000,
    cost: 500000,
  }),
  creatorSeed(DEMO_CREATOR_LOW_ID, "@daily_nuri", "누리", 8200, {
    reach: 6000,
    clicks: 90,
    conversions: 18,
    revenue: 240000,
    cost: 400000,
  }),
];

function demoEntry(creatorId: string, perf: { reach: number; clicks: number; conversions: number; revenue: number; cost: number }): CampaignEntry {
  return {
    creatorId,
    stage: "settled",
    performance: { campaignId: DEMO_CAMPAIGN_ID, ...perf, recordedAt: "2026-06-30T18:00:00+09:00" },
    paidAt: "2026-07-01T10:00:00+09:00",
    updatedAt: "2026-07-01T10:00:00+09:00",
  };
}

const DEMO_CAMPAIGN: InfluencerCampaign = {
  id: DEMO_CAMPAIGN_ID,
  name: "여름 수분 크림 — 완료 캠페인 시연",
  goal: "뷰티 스킨케어 신제품 인지도",
  brandProfileId: DEMO_BRAND_PROFILE_ID,
  budget: 1700000,
  startDate: "2026-06-01",
  endDate: "2026-06-30",
  entries: [
    demoEntry(DEMO_CREATOR_TOP_ID, { reach: 38000, clicks: 2400, conversions: 1520, revenue: 9800000, cost: 800000 }),
    demoEntry(DEMO_CREATOR_MID_ID, { reach: 12000, clicks: 540, conversions: 180, revenue: 2100000, cost: 500000 }),
    demoEntry(DEMO_CREATOR_LOW_ID, { reach: 6000, clicks: 90, conversions: 18, revenue: 240000, cost: 400000 }),
  ],
  createdAt: CREATED_AT,
};

// 멱등 — 이미 있으면 건드리지 않음. /creators, /creators/campaigns 진입 시 호출(browseMode 게이트는 호출측).
export function seedInfluencerDemo(): void {
  const existingCreators = creatorsSnapshot();
  for (const creator of DEMO_CREATORS) {
    if (!existingCreators.some((c) => c.id === creator.id)) upsertCreator(creator);
  }
  const existingCampaigns = influencerCampaignsSnapshot();
  if (!existingCampaigns.some((c) => c.id === DEMO_CAMPAIGN_ID)) upsertInfluencerCampaign(DEMO_CAMPAIGN);
}
