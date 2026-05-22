// Server-side winner detection for Auto Relaunch.
// Client-side ad optimization suggestions are in src/entities/insights/optimization.ts.

import type { Insights } from "@entities/insights/types";
import type { KpiTarget, WinnerEvidence } from "@entities/insights/winner-types";
import type { MetaObjectiveParam } from "./meta-ads";

export type { KpiTarget, WinnerEvidence };

// Mirrors constants in src/entities/insights/optimization.ts.
const MIN_IMPRESSIONS = 1_000;
const MIN_DAYS = 3;
const GOOD_CTR_PCT = 2.0;
const HIGH_CPC_KRW = 2000;
const HIGH_FREQUENCY = 3.0;
const HIGH_CPM_KRW = 8000;
const GOOD_ENGAGEMENT_RATE = 2.5;

function readKpi(ins: Insights, kpi: string): number {
  switch (kpi) {
    case "ctr":        return ins.ctr;
    case "cpc":        return ins.clicks > 0 ? ins.spend / ins.clicks : Infinity;
    case "cpm":        return ins.cpm ?? 0;
    case "frequency":  return ins.frequency ?? 0;
    case "impressions": return ins.impressions;
    case "clicks":     return ins.clicks;
    case "spend":      return ins.spend;
    case "reach":      return ins.reach ?? 0;
    default:           return 0;
  }
}

function meetsTarget(ins: Insights, t: KpiTarget): boolean {
  const current = readKpi(ins, t.kpi);
  return t.direction === "gte" ? current >= t.value : current <= t.value;
}

function engagementRate(ins: Insights): number {
  if (!ins.postEngagement || ins.impressions === 0) return 0;
  return (ins.postEngagement / ins.impressions) * 100;
}

export function isWinner(
  ins: Insights,
  objective: MetaObjectiveParam,
  userTargets: KpiTarget[] | null,
  daysOfData: number,
): { winner: boolean; evidence: WinnerEvidence | null } {
  if (ins.impressions < MIN_IMPRESSIONS || daysOfData < MIN_DAYS) {
    return { winner: false, evidence: null };
  }

  if (userTargets && userTargets.length > 0) {
    const allPass = userTargets.every((t) => meetsTarget(ins, t));
    if (!allPass) return { winner: false, evidence: null };
    return {
      winner: true,
      evidence: {
        kind: "kpi-target",
        passed: userTargets.map((t) => ({
          kpi: t.kpi,
          target: t.value,
          current: readKpi(ins, t.kpi),
          direction: t.direction,
        })),
      },
    };
  }

  switch (objective) {
    case "OUTCOME_TRAFFIC": {
      const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : Infinity;
      if (ins.ctr >= GOOD_CTR_PCT && cpc <= HIGH_CPC_KRW) {
        return {
          winner: true,
          evidence: {
            kind: "threshold",
            objective,
            passed: [
              { metric: "CTR", threshold: GOOD_CTR_PCT, current: ins.ctr },
              { metric: "CPC", threshold: HIGH_CPC_KRW, current: cpc },
            ],
          },
        };
      }
      return { winner: false, evidence: null };
    }
    case "OUTCOME_AWARENESS": {
      const freq = ins.frequency ?? 0;
      const cpm = ins.cpm ?? 0;
      if (freq <= HIGH_FREQUENCY && cpm <= HIGH_CPM_KRW) {
        return {
          winner: true,
          evidence: {
            kind: "threshold",
            objective,
            passed: [
              { metric: "빈도", threshold: HIGH_FREQUENCY, current: freq },
              { metric: "CPM", threshold: HIGH_CPM_KRW, current: cpm },
            ],
          },
        };
      }
      return { winner: false, evidence: null };
    }
    case "OUTCOME_ENGAGEMENT": {
      const er = engagementRate(ins);
      if (er >= GOOD_ENGAGEMENT_RATE) {
        return {
          winner: true,
          evidence: {
            kind: "threshold",
            objective,
            passed: [{ metric: "참여율", threshold: GOOD_ENGAGEMENT_RATE, current: er }],
          },
        };
      }
      return { winner: false, evidence: null };
    }
    default:
      return { winner: false, evidence: null };
  }
}
