// ADR-034 — Auto-Pilot(AI 자동 운영) 평가/적용 엔진. Browse Mode 데모 한정.
// 준비도(assessAutomationReadiness)는 데이터 양 + CTR≥LOW 를 게이트하므로, 켤 수 있는 캠페인은 이미 "관찰 충분".
// Auto-Pilot 은 그보다 높은 Winner 기준(GOOD_CTR_PCT)으로 다시 평가 — 호조면 증액, 미달이면 정책대로 감액/정지.

import { GOOD_CTR_PCT } from "@entities/insights/thresholds";
import { buildBrowseInsights } from "./insights";
import type { BrowseCampaign, AutoPilotAction } from "./types";

const BUMP_RATIO = 1.3;
const CUT_RATIO = 0.7;
const MIN_DAILY_BUDGET = 10_000;
const MAX_DAILY_BUDGET = 1_000_000;

const roundK = (n: number) => Math.round(n / 1000) * 1000;
const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

// 현재 일일예산 — budgetChanges 의 마지막 값(없으면 baseline).
export function currentDailyBudget(camp: BrowseCampaign): number {
  return camp.budgetChanges?.at(-1)?.dailyBudget ?? camp.dailyBudget;
}

// atDay 프런티어까지 누적된 성과로 다음 조치를 결정. 없으면 null.
export function evaluateAutoPilot(camp: BrowseCampaign, atDay: number): AutoPilotAction | null {
  if (camp.status === "ended") return null;
  const ins = buildBrowseInsights({ ...camp, fastForwardDays: atDay });
  const budget = currentDailyBudget(camp);

  if (ins.ctr >= GOOD_CTR_PCT) {
    const to = Math.min(MAX_DAILY_BUDGET, roundK(budget * BUMP_RATIO));
    if (to <= budget) return null;
    return {
      atDay,
      kind: "increase-budget",
      fromBudget: budget,
      toBudget: to,
      detail: `CTR ${ins.ctr.toFixed(2)}% 호조 — 일일예산 ${won(budget)} → ${won(to)} 증액`,
    };
  }

  if (camp.automationPolicy === "pause") {
    return {
      atDay,
      kind: "pause",
      detail: `CTR ${ins.ctr.toFixed(2)}% — 목표 ${GOOD_CTR_PCT.toFixed(1)}% 미달, 광고 정지`,
    };
  }

  const to = Math.max(MIN_DAILY_BUDGET, roundK(budget * CUT_RATIO));
  if (to >= budget) return null;
  return {
    atDay,
    kind: "decrease-budget",
    fromBudget: budget,
    toBudget: to,
    detail: `CTR ${ins.ctr.toFixed(2)}% — 목표 ${GOOD_CTR_PCT.toFixed(1)}% 미달, 일일예산 ${won(budget)} → ${won(to)} 감액`,
  };
}

// 조치를 캠페인에 반영한 새 객체 반환(불변). 예산 효과는 budgetChanges 에, 로그는 autoActions 에 append.
export function applyAutoPilotAction(camp: BrowseCampaign, action: AutoPilotAction): BrowseCampaign {
  const autoActions = [...(camp.autoActions ?? []), action];
  if (action.kind === "pause") {
    return { ...camp, status: "ended", autoActions };
  }
  const budgetChanges = [...(camp.budgetChanges ?? []), { atDay: action.atDay, dailyBudget: action.toBudget! }];
  return { ...camp, budgetChanges, autoActions };
}
