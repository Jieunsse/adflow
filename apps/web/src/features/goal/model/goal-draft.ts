import type { GoalMetric } from "@entities/insights/goal";

export const GOAL_DRAFT_STORAGE_KEY = "adflow_goal_draft_v1";

export type GoalDraft = {
  goalId: string | null;
  name: string;
  metric: GoalMetric;
  targetDraft: string;
  periodDays: number;
};

function isGoalMetric(value: unknown): value is GoalMetric {
  return value === "roas" || value === "cpa" || value === "contribution";
}

export function parseGoalDraft(raw: string): GoalDraft | null {
  try {
    const draft = JSON.parse(raw) as Partial<GoalDraft>;
    if (
      !draft ||
      typeof draft !== "object" ||
      !(draft.goalId === null || typeof draft.goalId === "string") ||
      typeof draft.name !== "string" ||
      !isGoalMetric(draft.metric) ||
      typeof draft.targetDraft !== "string" ||
      typeof draft.periodDays !== "number"
    ) return null;
    return draft as GoalDraft;
  } catch {
    return null;
  }
}

export function loadGoalDraft(goalId: string | null): GoalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GOAL_DRAFT_STORAGE_KEY);
    const draft = raw ? parseGoalDraft(raw) : null;
    return draft?.goalId === goalId ? draft : null;
  } catch {
    return null;
  }
}

export function saveGoalDraft(draft: GoalDraft): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(GOAL_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* sessionStorage 사용 불가 — 초안 저장 skip */
  }
}

export function clearGoalDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(GOAL_DRAFT_STORAGE_KEY);
  } catch {
    /* sessionStorage 사용 불가 — 초안 삭제 skip */
  }
}
