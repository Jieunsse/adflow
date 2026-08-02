import { applyPerformanceToHistory } from "@entities/creator/aggregate";
import type { Creator, CreatorPerformance } from "@entities/creator/model";
import type { CampaignEntry, CampaignStage, InfluencerCampaign } from "./model";

type EntryUpdate = {
  campaign: InfluencerCampaign;
  creator?: Creator;
};

export function updateCampaignEntry(
  campaign: InfluencerCampaign,
  creatorId: string,
  patch: Partial<CampaignEntry>,
  now: string,
): InfluencerCampaign {
  return {
    ...campaign,
    entries: campaign.entries.map((entry) =>
      entry.creatorId === creatorId ? { ...entry, ...patch, updatedAt: now } : entry,
    ),
  };
}

export function addCampaignEntry(
  campaign: InfluencerCampaign,
  creatorId: string,
  now: string,
): InfluencerCampaign {
  if (campaign.entries.some((entry) => entry.creatorId === creatorId)) return campaign;
  return {
    ...campaign,
    entries: [...campaign.entries, { creatorId, stage: "candidate", updatedAt: now }],
  };
}

export function transitionCampaignEntry({
  campaign,
  creator,
  creatorId,
  stage,
  now,
}: {
  campaign: InfluencerCampaign;
  creator?: Creator;
  creatorId: string;
  stage: CampaignStage;
  now: string;
}): EntryUpdate {
  const entry = campaign.entries.find((item) => item.creatorId === creatorId);
  const nextCampaign = updateCampaignEntry(
    campaign,
    creatorId,
    stage === "settled" ? { stage, paidAt: now } : { stage, paidAt: undefined },
    now,
  );
  if (entry?.stage !== "settled" || stage === "settled" || !creator) return { campaign: nextCampaign };

  return {
    campaign: nextCampaign,
    creator: {
      ...creator,
      performanceHistory: creator.performanceHistory.filter((performance) => performance.campaignId !== campaign.id),
    },
  };
}

export function settleCampaignEntry({
  campaign,
  creator,
  creatorId,
  performance,
  now,
}: {
  campaign: InfluencerCampaign;
  creator?: Creator;
  creatorId: string;
  performance?: CreatorPerformance;
  now: string;
}): EntryUpdate {
  const nextCampaign = updateCampaignEntry(campaign, creatorId, {
    stage: "settled",
    paidAt: now,
    performance,
  }, now);
  return {
    campaign: nextCampaign,
    ...(creator && performance ? { creator: applyPerformanceToHistory(creator, campaign.id, performance) } : {}),
  };
}

export function saveCampaignEntryPerformance({
  campaign,
  creator,
  creatorId,
  performance,
  now,
}: {
  campaign: InfluencerCampaign;
  creator?: Creator;
  creatorId: string;
  performance: CreatorPerformance;
  now: string;
}): EntryUpdate {
  const nextCampaign = updateCampaignEntry(campaign, creatorId, { performance }, now);
  const entry = campaign.entries.find((item) => item.creatorId === creatorId);
  return {
    campaign: nextCampaign,
    ...(creator && entry?.stage === "settled" ? { creator: applyPerformanceToHistory(creator, campaign.id, performance) } : {}),
  };
}
