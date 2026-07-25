// PRD-influencer-marketing.md §7·§8 — 캠페인 성과 집계 + 피드백 루프(성과 → 크리에이터 이력 반영). 순수 함수.
// ROAS 는 revenue·cost 둘 다 입력됐을 때만 계산(정직성 규칙, ADR-065 §4). 미입력 = undefined(0 아님).

import type { Creator, CreatorPerformance } from "./model";
import type { CampaignEntry } from "@entities/influencer-campaign/model";

export type AggregatedPerformance = {
  reach: number;
  clicks: number;
  conversions: number;
  revenue?: number;
  cost?: number;
  roas?: number;
};

export function aggregateCampaignPerformance(entries: CampaignEntry[]): AggregatedPerformance {
  const perfs = entries.map((e) => e.performance).filter((p): p is CreatorPerformance => p != null);

  const reach = perfs.reduce((s, p) => s + (p.reach ?? 0), 0);
  const clicks = perfs.reduce((s, p) => s + (p.clicks ?? 0), 0);
  const conversions = perfs.reduce((s, p) => s + (p.conversions ?? 0), 0);

  const revenues = perfs.map((p) => p.revenue).filter((v): v is number => v != null);
  const costs = perfs.map((p) => p.cost).filter((v): v is number => v != null);
  const revenue = revenues.length > 0 ? revenues.reduce((s, v) => s + v, 0) : undefined;
  const cost = costs.length > 0 ? costs.reduce((s, v) => s + v, 0) : undefined;
  const roas = revenue != null && cost != null && cost > 0 ? revenue / cost : undefined;

  return { reach, clicks, conversions, revenue, cost, roas };
}

// settled 시 캠페인 성과를 크리에이터 이력에 반영. 같은 campaignId 재정산은 교체(중복 append 방지).
export function applyPerformanceToHistory(
  creator: Creator,
  campaignId: string,
  perf: CreatorPerformance,
): Creator {
  const withoutExisting = creator.performanceHistory.filter((p) => p.campaignId !== campaignId);
  return {
    ...creator,
    performanceHistory: [...withoutExisting, { ...perf, campaignId }],
  };
}
