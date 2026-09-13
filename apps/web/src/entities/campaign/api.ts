import type { CampaignSummary, InsightsPeriod } from "@/lib/meta-ads";

export type CampaignsQueryError = Error & { code?: number };
export type CampaignControlParams = {
  campaignId: string;
  adSetId?: string;
  adId?: string;
  action: "pause" | "resume" | "set-daily-budget";
  dailyBudget?: number;
};
export type CampaignControlResult = { ok: true; status?: "ACTIVE" | "PAUSED"; dailyBudget?: number };

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (period: "all" | InsightsPeriod, example?: "good" | "poor") =>
    example ? (["campaigns", period, example] as const) : (["campaigns", period] as const),
};

// /campaigns, /approvals, 사이드바 배지가 같은 queryKey 로 캐시 공유.
// react-query key 컨벤션: ["campaigns", period].
export async function fetchCampaigns(period: "all" | InsightsPeriod = "all", example?: "good" | "poor"): Promise<CampaignSummary[]> {
  const params = new URLSearchParams({ period });
  if (example) params.set("example", example);
  const res = await fetch(`/api/campaigns?${params}`);
  const data = await res.json();
  if (res.status === 401) {
    const err: CampaignsQueryError = Object.assign(
      new Error(data?.error ?? "광고 계정을 먼저 연결해주세요."),
      { code: 401 },
    );
    throw err;
  }
  if (!res.ok) throw new Error(data?.error ?? "캠페인을 불러오지 못했어요");
  return (data.campaigns ?? []) as CampaignSummary[];
}

export async function controlCampaign(params: CampaignControlParams): Promise<CampaignControlResult> {
  const res = await fetch("/api/campaign/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json() as CampaignControlResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "캠페인을 변경하지 못했어요");
  return data;
}

export async function updateCampaignAdSet(campaignId: string, adSet: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/campaign/${campaignId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adSet }),
  });
  const data = await res.json() as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "캠페인을 수정하지 못했어요");
}

export async function replaceCampaignCreative(
  campaignId: string,
  body: { headline: string; primaryText: string; reuseExistingImage?: boolean; imageDataUrl?: string },
): Promise<void> {
  const res = await fetch(`/api/campaign/${campaignId}/replace-creative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "소재를 교체하지 못했어요");
}
