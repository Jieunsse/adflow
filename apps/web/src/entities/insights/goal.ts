// 목표 설정 — 계정 목표(ROAS/공헌이익/CPA)로부터 입찰 가드레일(CPC 상한·CTR 하한)을
// 역산하고, 현재 성과가 목표 대비 어디에 있는지 판정하는 순수함수.

import { bepRoas } from "./profit";
import { GOAL_AT_RISK_LOWER_RATIO, GOAL_AT_RISK_UPPER_RATIO } from "./thresholds";

export type GoalMetric = "roas" | "contribution" | "cpa";
/** @deprecated goals 다중화로 LagTarget/Goal 사용 */
export type AccountGoal = { metric: GoalMetric; target: number };

export type LagTarget = { metric: GoalMetric; target: number };

export type LeadMetricKind = "cpc-max" | "ctr-min";
export type LeadMetric = {
  kind: LeadMetricKind;
  value: number | null;
  source: "derived" | "custom";
  reason?: string;
};

export type Goal = {
  id: string;
  name: string;
  lag: LagTarget;
  leads: LeadMetric[];
  periodDays?: number;
  createdAt: string;
};

export type GuardrailInputs = {
  aov?: number;
  cvr?: number;
  cpm?: number;
  marginRate?: number | null;
};

export type Guardrail =
  | { kind: "cpc-max"; value: number }
  | { kind: "ctr-min"; value: number }
  | { kind: "unavailable"; metric: "cpc-max" | "ctr-min"; reason: string };

function ctrMinFrom(cpm: number | undefined, cpcMax: number): Guardrail {
  if (cpm == null || cpm <= 0) {
    return { kind: "unavailable", metric: "ctr-min", reason: "CPM 실측이 아직 없어요" };
  }
  return { kind: "ctr-min", value: cpm / (10 * cpcMax) };
}

function guardrailsFromRoasTarget(target: number, inputs: GuardrailInputs): Guardrail[] {
  const { aov, cvr, cpm } = inputs;
  if (target <= 0) {
    return [
      { kind: "unavailable", metric: "cpc-max", reason: "목표 ROAS가 올바르지 않아요" },
      { kind: "unavailable", metric: "ctr-min", reason: "목표 ROAS가 올바르지 않아요" },
    ];
  }
  if (aov == null || aov <= 0) {
    return [
      { kind: "unavailable", metric: "cpc-max", reason: "객단가 실측이 아직 없어요" },
      { kind: "unavailable", metric: "ctr-min", reason: "객단가 실측이 아직 없어요" },
    ];
  }
  if (cvr == null || cvr <= 0) {
    return [
      { kind: "unavailable", metric: "cpc-max", reason: "전환율 실측이 아직 없어요" },
      { kind: "unavailable", metric: "ctr-min", reason: "전환율 실측이 아직 없어요" },
    ];
  }
  const cpcMax = (aov * cvr) / target;
  return [{ kind: "cpc-max", value: cpcMax }, ctrMinFrom(cpm, cpcMax)];
}

function guardrailsFromCpaTarget(target: number, inputs: GuardrailInputs): Guardrail[] {
  const { cvr, cpm } = inputs;
  if (target <= 0) {
    return [
      { kind: "unavailable", metric: "cpc-max", reason: "목표 CPA가 올바르지 않아요" },
      { kind: "unavailable", metric: "ctr-min", reason: "목표 CPA가 올바르지 않아요" },
    ];
  }
  if (cvr == null || cvr <= 0) {
    return [
      { kind: "unavailable", metric: "cpc-max", reason: "전환율 실측이 아직 없어요" },
      { kind: "unavailable", metric: "ctr-min", reason: "전환율 실측이 아직 없어요" },
    ];
  }
  const cpcMax = target * cvr;
  return [{ kind: "cpc-max", value: cpcMax }, ctrMinFrom(cpm, cpcMax)];
}

export function deriveGuardrails(goal: LagTarget, inputs: GuardrailInputs): Guardrail[] {
  if (goal.metric === "cpa") {
    return guardrailsFromCpaTarget(goal.target, inputs);
  }
  if (goal.metric === "contribution") {
    const r = bepRoas(inputs.marginRate ?? null);
    if (r == null) {
      return [
        { kind: "unavailable", metric: "cpc-max", reason: "마진율이 아직 설정되지 않았어요" },
        { kind: "unavailable", metric: "ctr-min", reason: "마진율이 아직 설정되지 않았어요" },
      ];
    }
    return guardrailsFromRoasTarget(r, inputs);
  }
  return guardrailsFromRoasTarget(goal.target, inputs);
}

export type GoalProgressStatus = "on-track" | "at-risk" | "off-track" | "no-data";
export type GoalProgress = {
  status: GoalProgressStatus;
  currentValue: number | null;
  target: number;
  metric: GoalMetric;
};

function progressHigherIsBetter(currentValue: number | null, target: number, metric: GoalMetric): GoalProgress {
  if (currentValue == null) return { status: "no-data", currentValue: null, target, metric };
  if (currentValue >= target) return { status: "on-track", currentValue, target, metric };
  if (currentValue >= target * GOAL_AT_RISK_LOWER_RATIO) return { status: "at-risk", currentValue, target, metric };
  return { status: "off-track", currentValue, target, metric };
}

export function deriveGoalProgress(
  goal: LagTarget,
  current: { roas?: number | null; cpa?: number | null; contribution?: number | null },
  marginRate?: number | null,
): GoalProgress {
  if (goal.metric === "cpa") {
    const currentValue = current.cpa ?? null;
    if (currentValue == null) return { status: "no-data", currentValue: null, target: goal.target, metric: "cpa" };
    if (currentValue <= goal.target) return { status: "on-track", currentValue, target: goal.target, metric: "cpa" };
    if (currentValue <= goal.target * GOAL_AT_RISK_UPPER_RATIO) {
      return { status: "at-risk", currentValue, target: goal.target, metric: "cpa" };
    }
    return { status: "off-track", currentValue, target: goal.target, metric: "cpa" };
  }

  if (goal.metric === "contribution") {
    const target = bepRoas(marginRate ?? null);
    if (target == null) return { status: "no-data", currentValue: current.roas ?? null, target: 0, metric: "contribution" };
    return progressHigherIsBetter(current.roas ?? null, target, "contribution");
  }

  return progressHigherIsBetter(current.roas ?? null, goal.target, "roas");
}

export function deriveLeadChain(lag: LagTarget, inputs: GuardrailInputs): LeadMetric[] {
  return deriveGuardrails(lag, inputs).map((rail) => {
    if (rail.kind === "unavailable") {
      return { kind: rail.metric, value: null, source: "derived", reason: rail.reason };
    }
    return { kind: rail.kind, value: rail.value, source: "derived" };
  });
}

const RISK_SEVERITY: Record<GoalProgressStatus, number> = {
  "off-track": 3,
  "at-risk": 2,
  "on-track": 1,
  "no-data": 0,
};

export function pickMostAtRisk(
  goals: Goal[],
  current: { roas?: number | null; cpa?: number | null },
  marginRate?: number | null,
): { goal: Goal; progress: GoalProgress } | null {
  let best: { goal: Goal; progress: GoalProgress } | null = null;
  for (const goal of goals) {
    const progress = deriveGoalProgress(goal.lag, current, marginRate);
    if (best == null || RISK_SEVERITY[progress.status] > RISK_SEVERITY[best.progress.status]) {
      best = { goal, progress };
    }
  }
  return best;
}
