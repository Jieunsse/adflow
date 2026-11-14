import type { AdInsightsRow } from "@entities/insights/types";
import type { CampaignSummary, InsightsPeriod } from "@/lib/meta-ads";

export type CampaignDetailInsights = {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  daily: { date: string; clicks: number; ctr: number; spend: number }[];
  ads?: [AdInsightsRow, AdInsightsRow];
};

export const campaignDetailKeys = {
  detail: (id: string) => ["campaign-detail", id] as const,
  insights: (id: string, period: InsightsPeriod | "all", adIds?: readonly string[]) =>
    ["campaign-insights", id, period, ...(adIds ?? [])] as const,
};

async function readJson<T>(url: string, notFoundIs401Msg = "광고 계정을 먼저 연결해주세요."): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (res.status === 401) throw Object.assign(new Error(data?.error ?? notFoundIs401Msg), { code: 401 });
  if (!res.ok) throw new Error(data?.error ?? "불러오지 못했어요");
  return data as T;
}

export async function fetchCampaignDetail(id: string): Promise<CampaignSummary> {
  const data = await readJson<{ campaign: CampaignSummary }>(`/api/campaign/${id}`);
  return data.campaign;
}

export async function fetchCampaignInsights(
  id: string,
  period: InsightsPeriod | "all",
  adIds?: readonly string[],
): Promise<CampaignDetailInsights> {
  const params = new URLSearchParams({ period });
  if (adIds?.length) params.set("adIds", adIds.join(","));
  return readJson<CampaignDetailInsights>(`/api/insights/${id}?${params}`);
}
