import type { AnalysisCampaignMetrics } from "@/lib/meta-ads";
import type { AccountDailyPoint } from "./account-trend";

export type TrendPlacement = "facebook" | "instagram";

export type AnalysisTrend = {
  daily: AccountDailyPoint[];
  campaignMetrics: AnalysisCampaignMetrics[];
  placements: TrendPlacement[];
};

export const insightsKeys = {
  accountTrend: (days: number, example?: "good" | "poor") =>
    ["dashboard", "trend", days, example ?? null] as const,
  analysisTrend: (days: number, campaignId?: string, placement?: TrendPlacement) =>
    ["analysis", "trend", days, campaignId ?? null, placement ?? null] as const,
};

export async function fetchAccountTrend(days: number, example?: "good" | "poor"): Promise<AccountDailyPoint[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (example) params.set("example", example);
  const res = await fetch(`/api/dashboard/trend?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { daily?: AccountDailyPoint[] };
  return data.daily ?? [];
}

export async function fetchAnalysisTrend(
  days: number,
  campaignId?: string,
  placement?: TrendPlacement,
): Promise<AnalysisTrend> {
  const params = new URLSearchParams({ days: String(days), analysis: "1" });
  if (campaignId) params.set("campaignId", campaignId);
  if (placement) params.set("placement", placement);
  const res = await fetch(`/api/dashboard/trend?${params}`);
  const data = (await res.json()) as Partial<AnalysisTrend> & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "분석 데이터를 불러오지 못했어요.");
  return {
    daily: data.daily ?? [],
    campaignMetrics: data.campaignMetrics ?? [],
    placements: data.placements ?? [],
  };
}
