export type DailyRow = {
  date: string;
  clicks: number; ctr: number; spend: number;
  impressions?: number;
  reach?: number; frequency?: number; cpm?: number;
  postEngagement?: number; postReaction?: number; postComment?: number; postShare?: number;
};

export type Insights = {
  impressions: number; clicks: number; ctr: number; spend: number;
  reach?: number; frequency?: number; cpm?: number;
  postEngagement?: number; postReaction?: number; postComment?: number; postShare?: number; pageLike?: number;
  daily: DailyRow[];
};

export type CampaignObjective = "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_APP_PROMOTION";
