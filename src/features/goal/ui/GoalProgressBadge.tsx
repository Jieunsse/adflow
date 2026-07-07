"use client";

import Link from "next/link";
import type { Goal, GoalProgress, GoalProgressStatus } from "@entities/insights/goal";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import Icon from "@shared/ui/Icon";
import { fmtKRW } from "@shared/lib/format";

const STATUS_CHIP: Record<GoalProgressStatus, ChipVariant> = {
  "on-track": "success",
  "at-risk": "warn",
  "off-track": "neg",
  "no-data": "neutral",
};

const STATUS_LABEL: Record<GoalProgressStatus, string> = {
  "on-track": "목표 달성 중",
  "at-risk": "주의 필요",
  "off-track": "목표 미달",
  "no-data": "데이터 대기",
};

function formatMetricLine(goalName: string, progress: GoalProgress): string {
  if (progress.currentValue == null) {
    return `${goalName} · 전환 데이터가 모이면 진척을 보여드려요`;
  }
  if (progress.metric === "cpa") {
    return `${goalName} · 목표 CPA ${fmtKRW(progress.target)} · 현재 ${fmtKRW(progress.currentValue)}`;
  }
  if (progress.metric === "contribution") {
    return `${goalName} · BEP ROAS ${progress.target.toFixed(1)}x · 현재 ${progress.currentValue.toFixed(1)}x`;
  }
  return `${goalName} · 목표 ROAS ${progress.target.toFixed(1)}x · 현재 ${progress.currentValue.toFixed(1)}x`;
}

export interface GoalProgressBadgeProps {
  top: { goal: Goal; progress: GoalProgress } | null;
  totalCount: number;
  loading?: boolean;
}

export default function GoalProgressBadge({ top, totalCount, loading }: GoalProgressBadgeProps) {
  if (loading) return null;

  if (!top || totalCount === 0) {
    return (
      <Card variant="quiet" className="flex items-center justify-between gap-4 bg-[var(--w-bg-alternative)]">
        <div className="flex items-center gap-2.5">
          <Icon name="target" size={16} className="shrink-0 text-[var(--w-fg-alternative)]" />
          <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
            아직 목표가 없어요 — 후행 목표를 세우고 선행지표 가드레일을 받아보세요
          </span>
        </div>
        <Link
          href="/goals"
          className="inline-flex items-center gap-1 shrink-0 text-[13px] font-semibold text-[var(--w-primary-press)] hover:underline"
        >
          목표 세우기 <Icon name="arrow-right" size={13} />
        </Link>
      </Card>
    );
  }

  const { goal, progress } = top;

  return (
    <Card variant="quiet" className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <Chip variant={STATUS_CHIP[progress.status]} dot size="sm">
          {STATUS_LABEL[progress.status]}
        </Chip>
        <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] truncate">
          {formatMetricLine(goal.name, progress)}
        </span>
        {totalCount > 1 && (
          <Chip variant="neutral" size="sm">외 {totalCount - 1}개</Chip>
        )}
      </div>
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 shrink-0 text-[13px] font-semibold text-[var(--w-primary-press)] hover:underline"
      >
        목표 보기 <Icon name="arrow-right" size={13} />
      </Link>
    </Card>
  );
}
