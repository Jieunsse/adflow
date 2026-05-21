import type { CampaignSummary, InsightsPeriod } from "@/lib/meta-ads";

export type CampaignsQueryError = Error & { code?: number };

// /campaigns, /approvals, 사이드바 배지가 같은 queryKey 로 캐시 공유.
// react-query key 컨벤션: ["campaigns", period].
export async function fetchCampaigns(period: "all" | InsightsPeriod = "all"): Promise<CampaignSummary[]> {
  const res = await fetch(`/api/campaigns?period=${period}`);
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
