// PRD-ab-testing.md §6 — A/B 우세 판정.
// Phase 1 = CTR 단일 기준. Phase 2 후보 = 목표별 KPI 분기 (인지도=CPM 낮은 쪽, 참여=postEngagement 높은 쪽).

import type { AdInsightsRow } from "./types";

export const AB_VERDICT_THRESHOLDS = {
  minImpressionsPerAd: 1000,
  minClicksPerAd: 10,
  ctrRatio: 1.2,
} as const;

export type AdKpi = { ctr: number; impressions: number; clicks: number; spend: number };

export type AbVerdict =
  | {
      state: "insufficient";
      reason: "impressions" | "clicks";
      thresholds: { impressions: number; clicks: number };
      current: { a: AdKpi; b: AdKpi };
    }
  | { state: "inconclusive"; ratio: number; a: AdKpi; b: AdKpi }
  | { state: "winner"; winner: "A" | "B"; ratio: number; a: AdKpi; b: AdKpi };

export function judgeAbTest(a: AdKpi, b: AdKpi): AbVerdict {
  const { minImpressionsPerAd, minClicksPerAd, ctrRatio } = AB_VERDICT_THRESHOLDS;
  const thresholds = { impressions: minImpressionsPerAd, clicks: minClicksPerAd };
  const current = { a, b };

  if (Math.min(a.impressions, b.impressions) < minImpressionsPerAd) {
    return { state: "insufficient", reason: "impressions", thresholds, current };
  }
  if (Math.min(a.clicks, b.clicks) < minClicksPerAd) {
    return { state: "insufficient", reason: "clicks", thresholds, current };
  }

  const max = Math.max(a.ctr, b.ctr);
  const min = Math.min(a.ctr, b.ctr);
  const ratio = min > 0 ? max / min : Infinity;
  if (ratio < ctrRatio) {
    return { state: "inconclusive", ratio, a, b };
  }
  const winner: "A" | "B" = a.ctr >= b.ctr ? "A" : "B";
  return { state: "winner", winner, ratio, a, b };
}

// AdInsightsRow → AdKpi 매핑. 결과 카드/판정 함수 입력 정리.
export function rowToKpi(row: AdInsightsRow): AdKpi {
  return { ctr: row.ctr, impressions: row.impressions, clicks: row.clicks, spend: row.spend };
}
