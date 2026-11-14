import type { IgAccountInsights } from "@/lib/instagram-insights";

export const instagramKeys = {
  insights: ["instagram", "insights"] as const,
};

export async function fetchInstagramInsights(): Promise<IgAccountInsights> {
  const res = await fetch("/api/instagram/insights");
  if (!res.ok) throw new Error("Instagram 데이터를 불러오지 못했어요");
  return res.json() as Promise<IgAccountInsights>;
}
