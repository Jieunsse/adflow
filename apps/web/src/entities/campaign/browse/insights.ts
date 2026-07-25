// Browse 캠페인 → 결정적 Insights 생성. fastForwardDays 만큼 일별 시리즈를 만든다.
// 실제 isWinner / suggestOptimizations / DualChart 가 그대로 먹는 @entities/insights/types 의 Insights 형태.

import type { BrowseCampaign } from "./types";
import type { Insights, InsightsDailyRow } from "@entities/insights/types";

// Browse Mode 성과 탭 토글 — 같은 캠페인을 좋은/나쁜 성과 예시로 보여준다.
export type BrowseQuality = "good" | "bad";

// 좋음: CTR 높고 지출 효율적 / 나쁨: CTR 낮고 지출 과다.
const QUALITY_FACTOR: Record<BrowseQuality, { clicks: number; spend: number }> = {
  good: { clicks: 1.7, spend: 0.85 },
  bad: { clicks: 0.32, spend: 1.35 },
};

// 같은 (id, 지표, 일자)면 항상 같은 값 — getMockInsights 의 seededVariance 와 동일 아이디어.
function seededVariance(seed: string, index: number, span = 0.3): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h * 9301 + index * 49297 + 233280) | 0;
  const r = ((((h % 10000) + 10000) % 10000) / 10000);
  return 1 - span / 2 + r * span;
}

function isoDate(start: string, offsetDays: number): string {
  const d = new Date(start + "T00:00:00+09:00");
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// 일자 i 에 적용되는 예산 배수 — baseDaily 는 camp.dailyBudget(baseline)에 맞춰져 있으므로,
// 그 이후 증액된 변곡점 예산 / baseline 으로 볼륨만 스케일한다 (CTR·CPC 불변).
function budgetMultiplier(camp: BrowseCampaign, dayIndex: number): number {
  const changes = camp.budgetChanges;
  if (!changes?.length) return 1;
  const active = changes.filter((c) => c.atDay <= dayIndex).at(-1);
  return active ? active.dailyBudget / camp.dailyBudget : 1;
}

export function buildBrowseInsights(camp: BrowseCampaign, quality: BrowseQuality = "good"): Insights {
  const days = Math.max(0, camp.fastForwardDays);
  if (days === 0) {
    return { impressions: 0, clicks: 0, ctr: 0, spend: 0, daily: [] };
  }

  const qf = QUALITY_FACTOR[quality];
  const isSales = (camp.objective as string) === "OUTCOME_SALES";
  const daily: InsightsDailyRow[] = Array.from({ length: days }, (_, i) => {
    const m = budgetMultiplier(camp, i);
    const impressions = Math.round(camp.baseDailyImpressions * m * seededVariance(camp.id + "i", i));
    const clicks = Math.round(camp.baseDailyClicks * m * qf.clicks * seededVariance(camp.id + "c", i));
    const spend = Math.round(camp.baseDailySpend * m * qf.spend * seededVariance(camp.id + "s", i));
    const ctr = impressions ? (clicks / impressions) * 100 : 0;
    // ADR-059 데모 — 추세/퍼널 도착 단을 채운다(트래픽=도착 측정 가정). 결정적 ~62%.
    const landingPageView = Math.round(clicks * 0.62 * seededVariance(camp.id + "l", i));
    // 전환 캠페인이면 일별 매출도 채움(듀얼추세 매출축). 비전환은 매출 필드 없음(정직).
    const purchaseValue = isSales ? Math.round(spend * 3.4 * (quality === "good" ? 1 : 0.55) * seededVariance(camp.id + "v", i)) : undefined;
    const purchaseCount = isSales ? Math.round(clicks * 0.07 * seededVariance(camp.id + "p", i)) : undefined;
    return { date: isoDate(camp.startDate, i), clicks, ctr, spend, impressions, landingPageView, purchaseValue, purchaseCount };
  });

  const impressions = daily.reduce((s, d) => s + (d.impressions ?? 0), 0);
  const clicks = daily.reduce((s, d) => s + d.clicks, 0);
  const spend = daily.reduce((s, d) => s + d.spend, 0);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const landingPageView = daily.reduce((s, d) => s + (d.landingPageView ?? 0), 0);

  // 인지도 룰(빈도·CPM)과 준비도 헤드라인이 빈손이 되지 않도록 파생 지표도 채운다.
  const frequency = 1.3;
  const reach = Math.round(impressions / frequency);
  const cpm = impressions ? (spend / impressions) * 1000 : 0;

  // ADR-057 데모 — 전환 캠페인이면 매출 합성(데모≠실값, daily 합산). 트래픽·인지도는 전환 미측정 = 매출 필드 없음(정직).
  const sales = isSales && spend > 0
    ? (() => {
        const purchaseValue = daily.reduce((s, d) => s + (d.purchaseValue ?? 0), 0);
        const purchaseCount = daily.reduce((s, d) => s + (d.purchaseCount ?? 0), 0);
        return { purchaseCount, purchaseValue, roas: Math.round((purchaseValue / spend) * 100) / 100 };
      })()
    : {};

  return { impressions, clicks, ctr, spend, reach, frequency, cpm, landingPageView, ...sales, daily };
}
