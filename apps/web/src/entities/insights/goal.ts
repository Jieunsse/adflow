// 목표 설정 — 현재 성과가 목표 대비 어디에 있는지 판정하는 순수함수.

import { bepRoas } from "./profit";
import { GOAL_AT_RISK_LOWER_RATIO, GOAL_AT_RISK_UPPER_RATIO } from "./thresholds";

export type GoalMetric = "roas" | "contribution" | "cpa";
/** @deprecated goals 다중화로 LagTarget/Goal 사용 */
export type AccountGoal = { metric: GoalMetric; target: number };

export type LagTarget = { metric: GoalMetric; target: number };

export type Goal = {
  id: string;
  name: string;
  lag: LagTarget;
  periodDays?: number;
  /** 목표를 세운 시점의 후행 목표 실측. 추적 화면이 "시작 2.1x → 목표 3.0x" 를 그리는 기준선. */
  baseline?: number;
  /**
   * 목표를 세운 시점의 선행지표 실측 스냅샷. 선행지표 목표치는 이 값에서 역산해 고정한다 —
   * 오늘 실측으로 매번 다시 역산하면 목표선이 실측을 따라다녀서 진척이 영원히 0 이 된다.
   */
  baselineInputs?: { ctr?: number; cvr?: number; aov?: number; cpc?: number; cpm?: number };
  createdAt: string;
};

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
