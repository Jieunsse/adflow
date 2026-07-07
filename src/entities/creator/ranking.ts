// PRD-influencer-marketing.md §7, ADR-065 §3 — 크리에이터 적합도 랭킹. 순수 함수, LLM 미사용.
// 스코어 = 카테고리 적합도 + 과거 실적(풀 내 상대 백분위) + 팔로워 보조 가중(log). 결정적·재현 가능.

import type { Creator, CreatorRankResult } from "./model";
import type { InfluencerCampaign } from "@entities/influencer-campaign/model";

const CATEGORY_MATCH_SCORE = 40;
const PAST_PERFORMANCE_WEIGHT = 40;
const FOLLOWER_WEIGHT = 10;

function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

// 캠페인 목표+제품명 문자열에 creator.category 태그가 포함되면 적합으로 본다(단순 포함 매칭).
function isCategoryMatch(creator: Creator, campaign: InfluencerCampaign): boolean {
  const haystack = normalizeTag(`${campaign.goal} ${campaign.productId ?? ""}`);
  return creator.category.some((tag) => haystack.includes(normalizeTag(tag)));
}

// 전환율 = conversions / (reach || clicks). 분모 없으면 계산 불가(무시).
function conversionRateOf(perf: { reach?: number; clicks?: number; conversions?: number }): number | null {
  const denom = perf.reach ?? perf.clicks;
  if (denom == null || denom <= 0 || perf.conversions == null) return null;
  return perf.conversions / denom;
}

function roasOf(perf: { revenue?: number; cost?: number }): number | null {
  if (perf.revenue == null || perf.cost == null || perf.cost <= 0) return null;
  return perf.revenue / perf.cost;
}

// 크리에이터의 이력 전체를 합산해 평균 전환율·평균 ROAS 도출. 이력 없으면 둘 다 null.
function creatorTrack(creator: Creator): { conversionRate: number | null; roas: number | null } {
  const rates = creator.performanceHistory.map(conversionRateOf).filter((r): r is number => r != null);
  const roases = creator.performanceHistory.map(roasOf).filter((r): r is number => r != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return { conversionRate: avg(rates), roas: avg(roases) };
}

// 값이 풀 내에서 몇 번째로 큰지 0..1 백분위로 환산. 값 없음/풀 전체 0 이면 0.
function percentileRank(value: number | null, pool: (number | null)[]): number {
  if (value == null) return 0;
  const measured = pool.filter((v): v is number => v != null);
  if (measured.length <= 1) return measured.length === 1 ? 1 : 0;
  const belowOrEqual = measured.filter((v) => v <= value).length;
  return (belowOrEqual - 1) / (measured.length - 1);
}

function followerScore(followerCount: number | undefined, maxFollowers: number): number {
  if (!followerCount || followerCount <= 0 || maxFollowers <= 0) return 0;
  const logValue = Math.log10(followerCount + 1);
  const logMax = Math.log10(maxFollowers + 1);
  return logMax > 0 ? logValue / logMax : 0;
}

export function rankCreators(creators: Creator[], campaign: InfluencerCampaign): CreatorRankResult[] {
  const tracks = creators.map(creatorTrack);
  const conversionPool = tracks.map((t) => t.conversionRate);
  const roasPool = tracks.map((t) => t.roas);
  const maxFollowers = Math.max(0, ...creators.map((c) => c.followerCount ?? 0));

  const results = creators.map((creator, i) => {
    const reasons: string[] = [];
    let score = 0;

    if (isCategoryMatch(creator, campaign)) {
      score += CATEGORY_MATCH_SCORE;
      reasons.push("카테고리 적합");
    }

    const hasHistory = creator.performanceHistory.length > 0;
    if (hasHistory) {
      const convPercentile = percentileRank(tracks[i].conversionRate, conversionPool);
      const roasPercentile = percentileRank(tracks[i].roas, roasPool);
      const historyScore = Math.max(convPercentile, roasPercentile);
      score += historyScore * PAST_PERFORMANCE_WEIGHT;
      if (convPercentile >= 0.5 || roasPercentile >= 0.5) reasons.push("지난 캠페인 전환 상위");
    } else {
      reasons.push("협업 이력 없음");
    }

    score += followerScore(creator.followerCount, maxFollowers) * FOLLOWER_WEIGHT;

    return { creator, score, reasons };
  });

  return results.sort((a, b) => b.score - a.score);
}
