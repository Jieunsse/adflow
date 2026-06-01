// ADR-032/033 — Browse Mode 전용 Round Report. 결산된 Round 를 Meta API 의 실제 A/B 결과처럼 표시.
// 엔진(settleRound/CTR 승격 룰)·공유 타입(AdKpi)은 불변 — 4필드 AdKpi 를 받아 순수 파생.
// CONTEXT.md "통계적 표기 ≠ 승격 기준" 원칙의 시각적 확장. confidence/status 는 표시값일 뿐 승격에 관여 X.

import type { AdKpi } from "@entities/insights/ab-verdict";
import { confidenceFromZTest, confidenceFromCountTest, WINNER_CONFIDENCE } from "./tournament";
import { tourMetricSpec } from "./objective-metric";

// 광고 1개의 확장 지표 — 4필드 AdKpi 에서 결정적 파생 (3 카테고리).
export type AdReport = {
  ctr: number;
  impressions: number;
  clicks: number;
  spend: number;
  // 노출 & 도달
  reach: number;
  frequency: number;
  cpm: number;
  // 클릭 & 참여
  linkClicks: number;
  cpc: number;
  // 예산 & 지출
  budgetRemaining: number;
};

export type RoundStatus = "COMPLETED" | "INCONCLUSIVE";

export type RoundReport = {
  ads: [AdReport, AdReport];
  confidenceLevel: number; // 0..1 — 2-비율 z-검정 파생 (표시 전용)
  status: RoundStatus; // COMPLETED(유의) / INCONCLUSIVE(불충분) — confidence 임계 파생
};

// ADR-037 — 엔진(tournament.ts)의 z-검정·임계를 단일 소스로 승격(표시용 복제 제거).
// confidence ≥ WINNER_CONFIDENCE(0.9) → COMPLETED. 근소한 CTR 차이는 INCONCLUSIVE.
export const COMPLETED_CONFIDENCE = WINNER_CONFIDENCE;

// 결정적 시드 — tournament.ts seededUnit 과 동일 아이디어 (report 자족용 복제).
function seededUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h * 9301 + 49297 + 233280) | 0;
  return ((h % 10000) + 10000) % 10000 / 10000;
}

function buildAd(kpi: AdKpi, seed: string, perAdBudget: number): AdReport {
  if (kpi.impressions <= 0) {
    return { ...kpi, reach: 0, frequency: 0, cpm: 0, linkClicks: 0, cpc: 0, budgetRemaining: perAdBudget };
  }
  const frequency = Math.round((1.1 + seededUnit(seed + "fq") * 0.4) * 100) / 100; // 1.1~1.5
  const reach = Math.round(kpi.impressions / frequency);
  const cpm = Math.round((kpi.spend / kpi.impressions) * 1000);
  const linkClicks = Math.round(kpi.clicks * (0.85 + seededUnit(seed + "lc") * 0.1)); // 85~95%, ≤ clicks
  const cpc = kpi.clicks > 0 ? Math.round(kpi.spend / kpi.clicks) : 0;
  const budgetRemaining = Math.max(0, perAdBudget - kpi.spend);
  return { ...kpi, reach, frequency, cpm, linkClicks, cpc, budgetRemaining };
}

// kpis(엔진 산출 4필드) → Meta 스타일 확장 리포트. days/dailyBudget 은 예산·시드 파생용.
// objective 별 표시 신뢰도 — rate=z-검정(클릭 비율) / cpm(awareness)=노출 카운트 검정. 미지정 시 traffic.
export function buildRoundReport(
  kpis: [AdKpi, AdKpi],
  ctx: { seed: string; dailyBudget: number; days: number; objective?: string },
): RoundReport {
  const [a, b] = kpis;
  const perAdBudget = Math.round((ctx.dailyBudget * Math.max(0, ctx.days)) / 2); // A/B 50:50 분배
  const ads: [AdReport, AdReport] = [
    buildAd(a, ctx.seed + "a", perAdBudget),
    buildAd(b, ctx.seed + "b", perAdBudget),
  ];
  const confidenceLevel = tourMetricSpec(ctx.objective ?? "traffic").kind === "cpm"
    ? confidenceFromCountTest(a.impressions, b.impressions)
    : confidenceFromZTest(a, b);
  const status: RoundStatus = confidenceLevel >= COMPLETED_CONFIDENCE ? "COMPLETED" : "INCONCLUSIVE";
  return { ads, confidenceLevel, status };
}
