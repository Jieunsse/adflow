// 플로(Flo) 5소스 횡단 수집 (one-shot, server-side only). ADR-045.
// 광고 성과·IG 오가닉·FB 페이지·진행 중 토너먼트를 세션 토큰으로 모으고, 룰 판정
// (fake-performance·channel optimizations)을 재료로 동반 부착한다. 브랜드는 클라가 POST 바디로 주입.
// 한 소스가 실패해도 Briefing 은 나오도록 allSettled — 플로는 "있는 신호를 잇는 자".

import { metaAds } from "@/lib/meta-ads";
import { getInstagramInsights } from "@/lib/instagram-insights";
import { getFacebookInsights } from "@/lib/facebook-insights";
import { isFakePerformance } from "@entities/insights/fake-performance";
import { suggestChannelOptimizations } from "@entities/insights/optimization";
import { supabaseTournamentStore, ownerKeyFrom } from "@entities/ab-test/tournament/real";
import type { ResolvedSession } from "@/lib/meta-session";
import type {
  FloContext,
  FloBrandFact,
  FloCampaignFact,
  FloChannelFact,
  FloTournamentFact,
} from "./types";

const DAY_MS = 86_400_000;
const MAX_CAMPAIGNS = 12;
const MAX_TOURNAMENTS = 6;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / DAY_MS));
}

export async function gatherFloContext(
  s: ResolvedSession,
  email: string | null | undefined,
  brand: FloBrandFact | undefined,
): Promise<FloContext> {
  const [campaignsRes, igRes, fbRes, tournamentsRes] = await Promise.allSettled([
    metaAds.listCampaigns(s.accessToken, s.adAccountId, "30d"),
    s.igUserId || s.pageId
      ? getInstagramInsights(s.pageId, s.accessToken, s.igUserId, s.igAccessToken)
      : Promise.reject(new Error("no-ig")),
    s.pageId ? getFacebookInsights(s.pageId, s.accessToken) : Promise.reject(new Error("no-fb")),
    supabaseTournamentStore.listByOwner(ownerKeyFrom(email, s.accessToken)),
  ]);

  const campaigns: FloCampaignFact[] =
    campaignsRes.status === "fulfilled"
      ? campaignsRes.value
          .filter((c) => c.impressions > 0)
          .slice(0, MAX_CAMPAIGNS)
          .map((c) => {
            const fp = isFakePerformance(
              {
                impressions: c.impressions,
                ctr: c.ctr,
                linkClick: c.linkClick ?? 0,
                landingPageView: c.landingPageView,
              },
              daysSince(c.startDate),
            );
            return {
              headline: c.headline,
              objective: c.objective,
              status: c.status,
              impressions: c.impressions,
              clicks: c.clicks,
              ctr: c.ctr,
              spend: c.spend,
              dailyBudget: c.dailyBudget,
              fakePerformance:
                fp.fake && fp.evidence
                  ? `가짜 성과 의심 — CTR ${fp.evidence.ctr}% 대비 도착률 ${fp.evidence.landingRate}% (클릭 후 이탈 ${fp.evidence.dropRate}%)`
                  : null,
            };
          })
      : [];

  let instagram: FloChannelFact | undefined;
  if (igRes.status === "fulfilled") {
    const ig = igRes.value;
    const suggestions = suggestChannelOptimizations("instagram", {
      followers: ig.followers,
      engagementRate: ig.engagementRate,
      reach: ig.reach,
      posts: ig.posts.map((p) => ({ id: p.id, engagement: p.likeCount + p.commentCount + p.savedCount })),
    });
    instagram = {
      channel: "instagram",
      followers: ig.followers,
      engagementRate: ig.engagementRate,
      suggestions: suggestions.map((x) => x.title),
    };
  }

  let facebook: FloChannelFact | undefined;
  if (fbRes.status === "fulfilled") {
    const fb = fbRes.value;
    const suggestions = suggestChannelOptimizations("facebook", {
      followers: fb.followers,
      engagementRate: fb.engagementRate,
      postCount28d: fb.postCount28d,
      posts: fb.posts.map((p) => ({ id: p.id, engagement: p.reactionsCount + p.commentsCount + p.sharesCount })),
    });
    facebook = {
      channel: "facebook",
      followers: fb.followers,
      engagementRate: fb.engagementRate,
      suggestions: suggestions.map((x) => x.title),
    };
  }

  const tournaments: FloTournamentFact[] =
    tournamentsRes.status === "fulfilled"
      ? tournamentsRes.value
          .filter((t) => t.status === "running")
          .slice(0, MAX_TOURNAMENTS)
          .map((t) => {
            const last = t.rounds[t.rounds.length - 1];
            return {
              productName: t.productName,
              objective: t.objective,
              round: t.rounds.length,
              latestVerdict: last?.verdict ? String(last.verdict) : undefined,
            };
          })
      : [];

  return { adAccountId: s.adAccountId, campaigns, instagram, facebook, tournaments, brand };
}
