// Insights = Meta API 의 캠페인 성과 데이터. 도메인 어휘는 .document/CONTEXT.md §Insights.
// 캠페인 목표별로 채워지는 필드가 다름 — 공통은 항상, 그 외는 optional.

export type CampaignObjective =
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_APP_PROMOTION";

export type InsightsDailyRow = {
  date: string;
  clicks: number;
  ctr: number;
  spend: number;
  impressions?: number;
  reach?: number;
  frequency?: number;
  cpm?: number;
  postEngagement?: number;
  postReaction?: number;
  postComment?: number;
  postShare?: number;
  // PRD §13 신규 goal — 페이지 방문 / 페이지 팔로우 / 메시지 / 전화. Meta `actions[]` 에서 추출.
  landingPageView?: number;
  pageLikeNew?: number;
  messagingConversationsStarted?: number;
  callConfirm?: number;
  // ADR-057 — 전환 가치(읽기 경로). actions[].purchase / action_values[].purchase / purchase_roas.
  purchaseCount?: number;
  purchaseValue?: number;
  roas?: number;
};

export type Insights = {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  reach?: number;
  frequency?: number;
  cpm?: number;
  postEngagement?: number;
  postReaction?: number;
  postComment?: number;
  postShare?: number;
  pageLike?: number;
  // PRD §13 신규 goal — totals 누적치.
  landingPageView?: number;
  pageLikeNew?: number;
  messagingConversationsStarted?: number;
  callConfirm?: number;
  // ADR-057 — 전환 가치(읽기 경로). 전환 캠페인에서만 채워짐(미측정 시 undefined → 게이트).
  purchaseCount?: number;
  purchaseValue?: number;
  roas?: number;
  daily: InsightsDailyRow[];
  // PRD-ab-testing.md §7.2 — A/B 시험 시 광고별 row 두 개. adIds 가 있을 때만 채워짐.
  ads?: [AdInsightsRow, AdInsightsRow];
};

// PRD-ab-testing.md §6.3 — judgeAbTest 입력 = AdKpi. AdInsightsRow = adId + AdKpi.
export type AdInsightsRow = {
  adId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
};
