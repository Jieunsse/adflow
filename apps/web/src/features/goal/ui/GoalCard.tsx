"use client";

import { useState } from "react";
import type { Goal, LeadMetric, LeadMetricKind } from "@entities/insights/goal";
import { deriveGoalProgress, type GoalProgress } from "@entities/insights/goal";
import type { GuardrailInputs } from "@entities/insights/goal";
import { bepRoas } from "@entities/insights/profit";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { fmtKRW } from "@shared/lib/format";
import { MetricChainFlow } from "./MetricChainFlow";

const STATUS_CHIP: Record<GoalProgress["status"], ChipVariant> = {
  "on-track": "success",
  "at-risk": "warn",
  "off-track": "neg",
  "no-data": "neutral",
};

const STATUS_LABEL: Record<GoalProgress["status"], string> = {
  "on-track": "목표 달성 중",
  "at-risk": "주의 필요",
  "off-track": "목표 미달",
  "no-data": "데이터 대기",
};

function formatMetricValue(metric: Goal["lag"]["metric"], value: number): string {
  return metric === "cpa" ? fmtKRW(Math.round(value)) : `${value.toFixed(2)}x`;
}

export function GoalCard({
  goal,
  inputs,
  current,
  marginRate,
  activeCampaignCount,
  totalDailyBudget,
  periodCtr,
  onEdit,
  onDelete,
  onUpdateLead,
  onResetLead,
}: {
  goal: Goal;
  inputs: GuardrailInputs;
  current: { roas?: number | null; cpa?: number | null };
  marginRate: number | null;
  activeCampaignCount: number;
  totalDailyBudget: number | null;
  periodCtr: number | null;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateLead: (goalId: string, lead: LeadMetric) => void;
  onResetLead: (goalId: string, kind: LeadMetricKind) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const progress = deriveGoalProgress(goal.lag, current, marginRate);
  // 저장 시점 스냅샷 대신 판정 시점 재계산 — 마진율 변경 시 stale 방지
  const bepTarget = goal.lag.metric === "contribution" ? bepRoas(marginRate) : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)] truncate">{goal.name}</span>
          <Chip variant={STATUS_CHIP[progress.status]} dot size="sm">{STATUS_LABEL[progress.status]}</Chip>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)]">
            {progress.currentValue != null
              ? `현재 ${formatMetricValue(progress.metric === "contribution" ? "roas" : goal.lag.metric, progress.currentValue)} / 목표 ${formatMetricValue(progress.metric === "contribution" ? "roas" : goal.lag.metric, progress.target)}`
              : "데이터 대기 중"}
          </span>
          <Button variant="ghost" size="sm" type="button" onClick={onEdit}>수정</Button>
          <Button variant="ghost" size="sm" type="button" onClick={onDelete}>삭제</Button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-semibold text-[12px] text-[var(--w-fg-alternative)] hover:text-[var(--w-fg-neutral)] hover:underline"
          >
            {expanded ? "접기" : "펼치기"}
          </button>
        </div>
      </div>

      {expanded && (
        <MetricChainFlow
          goal={goal}
          inputs={inputs}
          activeCampaignCount={activeCampaignCount}
          totalDailyBudget={totalDailyBudget}
          periodCtr={periodCtr}
          current={current}
          bepTarget={bepTarget}
          onUpdateLead={(lead) => onUpdateLead(goal.id, lead)}
          onResetLead={(kind) => onResetLead(goal.id, kind)}
        />
      )}
    </Card>
  );
}
