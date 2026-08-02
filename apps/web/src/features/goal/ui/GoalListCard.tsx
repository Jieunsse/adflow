"use client";

// 목표 목록의 한 줄 — 한 문장 + 진척 막대. 자세한 건 추적 화면에서 본다.

import Link from "next/link";
import type { Goal } from "@entities/insights/goal";
import { deriveGoalPace, lagTargetOf } from "@entities/insights/backcast";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { fmtLagValue, lagMetricLabel, lagUnit } from "./BackcastPanel";

export function GoalListCard({
  goal,
  current,
  marginRate,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  current: { roas?: number | null; cpa?: number | null };
  marginRate: number | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const metric = goal.lag.metric;
  const unit = lagUnit(metric);
  const target = lagTargetOf(goal.lag, marginRate);
  const now = metric === "cpa" ? current.cpa ?? null : current.roas ?? null;
  const periodDays = goal.periodDays ?? 30;
  const pace = deriveGoalPace({
    metric,
    baseline: goal.baseline ?? null,
    currentValue: now,
    target,
    createdAt: goal.createdAt,
    periodDays,
    now: new Date(),
  });

  return (
    <div className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[16px] leading-tight text-[var(--w-fg-strong)] truncate">{goal.name}</span>
            {pace.ahead != null && (
              <Chip variant={pace.ahead ? "success" : "warn"} dot size="sm">
                {pace.ahead ? "경로보다 앞서요" : "경로보다 뒤처져요"}
              </Chip>
            )}
            {pace.daysLeft != null && (
              <Chip variant="neutral" size="sm">
                D-{pace.daysLeft}
              </Chip>
            )}
          </div>
          <span className="font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)]">
            {lagMetricLabel(metric)}를{" "}
            <strong className="font-bold text-[var(--w-fg-strong)]">
              {fmtLagValue(metric, target)}
              {unit}
            </strong>
            까지, {periodDays}일 동안 · 지금 {fmtLagValue(metric, now)}
            {unit}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" type="button" onClick={onEdit}>
            수정
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={onDelete}>
            삭제
          </Button>
          <Link href={`/goals/${goal.id}`} className="no-underline">
            <Button variant="secondary" size="sm" type="button">
              추적 화면 <Icon name="arrow-right" size={14} />
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative h-2 rounded-full bg-[var(--w-bg-neutral)]">
        <span
          className="absolute left-0 top-0 bottom-0 rounded-full bg-[var(--w-primary-normal)]"
          style={{ width: `${pace.progressPct ?? 0}%` }}
        />
        {pace.expectedPct != null && (
          <span
            className="absolute -top-1 -bottom-1 w-0.5 rounded-sm bg-[var(--w-fg-alternative)]"
            style={{ left: `${pace.expectedPct}%` }}
          />
        )}
      </div>
    </div>
  );
}
