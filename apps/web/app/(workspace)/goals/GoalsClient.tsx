"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import type { Goal } from "@entities/insights/goal";
import { useGoalMeasurements } from "@features/goal/model/useGoalMeasurements";
import { GoalWizard } from "@features/goal/ui/GoalWizard";
import { GoalListCard } from "@features/goal/ui/GoalListCard";

export default function GoalsClient() {
  const m = useGoalMeasurements();
  const router = useRouter();
  const [wizard, setWizard] = useState<{ goal: Goal | null } | null>(null);

  const save = (goal: Goal) => {
    if (m.goals.some((g) => g.id === goal.id)) m.updateGoal(goal);
    else m.addGoal(goal);
  };

  const campaignNames = m.campaigns.filter((c) => c.status === "live").map((c) => c.name);

  return (
    <div
      className="px-5 sm:px-8 lg:px-12 py-7 lg:py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-6"
      data-screen-label="목표 설정"
    >
      <div className="flex justify-between items-start gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">
              성과 목표
            </span>
            {m.browseMode && (
              <Chip variant="neutral" size="sm">
                예시
              </Chip>
            )}
          </div>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0 max-w-[640px]">
            후행 목표를 세우면 선행지표를 역산해서 추적해드려요. 노출수 같은 허영지표는 목표 후보에 두지 않아요 — 행동으로
            이어지는 지표만 추적해요.
          </p>
        </div>
        <Button variant="primary" size="md" type="button" onClick={() => setWizard({ goal: null })}>
          <Icon name="plus" size={14} /> 목표 세우기
        </Button>
      </div>

      {m.loading ? (
        <Skeleton className="h-[160px] rounded-2xl" />
      ) : m.goals.length === 0 ? (
        <EmptyState
          icon={<Icon name="target" size={26} />}
          title="아직 목표가 없어요"
          desc="후행 목표를 세우면 거기까지 가는 선행지표를 역산해서 매일 추적해드려요."
          action={
            <Button variant="primary" size="md" type="button" onClick={() => setWizard({ goal: null })}>
              첫 목표 세우기
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {m.goals.map((goal) => (
            <GoalListCard
              key={goal.id}
              goal={goal}
              current={m.current}
              marginRate={m.marginRate}
              onEdit={() => setWizard({ goal })}
              onDelete={() => m.removeGoal(goal.id)}
            />
          ))}
        </div>
      )}

      {wizard && (
        <GoalWizard
          goal={wizard.goal}
          inputs={m.inputs}
          current={m.current}
          marginRate={m.marginRate}
          campaignNames={campaignNames}
          onSave={save}
          onClose={() => setWizard(null)}
          onOpenTracker={(id) => router.push(`/goals/${id}`)}
        />
      )}
    </div>
  );
}
