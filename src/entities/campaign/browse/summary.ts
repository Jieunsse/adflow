// BrowseCampaign → CampaignSummary 매핑. /campaigns 목록이 browseMode 에서 정적 mock 과 함께 노출,
// /campaigns/[id] 가 행 메타데이터로 사용. 성과 4종은 buildBrowseInsights 로 결정적 합성.

import type { CampaignSummary } from "@/lib/meta-ads";
import type { BrowseCampaign } from "./types";
import { buildBrowseInsights } from "./insights";
import { currentDailyBudget } from "./auto-pilot";

const GOAL_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC: "트래픽",
  OUTCOME_AWARENESS: "인지도",
  OUTCOME_ENGAGEMENT: "참여",
  OUTCOME_LEADS: "잠재고객",
  OUTCOME_SALES: "매출",
  OUTCOME_APP_PROMOTION: "앱 홍보",
};

export function browseCampaignToSummary(camp: BrowseCampaign): CampaignSummary {
  const ins = buildBrowseInsights(camp);
  return {
    id: camp.id,
    name: camp.name,
    headline: camp.headline,
    status: camp.status,
    objective: camp.objective,
    goal: GOAL_LABEL[camp.objective] ?? "트래픽",
    startDate: camp.startDate,
    endDate: camp.endDate ?? null,
    adSetId: null,
    adId: null,
    dailyBudget: currentDailyBudget(camp),
    impressions: ins.impressions,
    clicks: ins.clicks,
    ctr: Math.round(ins.ctr * 100) / 100,
    spend: ins.spend,
    // ADR-059 — 퍼널 게이트용. 도착(트래픽 측정)·전환(sales) 노출. link_click ≈ clicks 근사.
    linkClick: ins.clicks,
    landingPageView: ins.landingPageView,
    purchaseCount: ins.purchaseCount,
    purchaseValue: ins.purchaseValue,
    roas: ins.roas,
    issueReason: null,
    imageUrl: camp.imageUrl,
    primaryText: camp.primaryText,
    cta: camp.cta,
    landingUrl: camp.landingUrl,
    ageMin: camp.ageMin,
    ageMax: camp.ageMax,
    genders: camp.genders,
    countries: camp.countries,
  };
}
