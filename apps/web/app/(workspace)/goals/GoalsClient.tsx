"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import type { Goal } from "@entities/insights/goal";
import { useGoalMeasurements } from "@features/goal/model/useGoalMeasurements";
import { clearGoalDraft } from "@features/goal/model/goal-draft";
import { GoalWizard } from "@features/goal/ui/GoalWizard";
import { GoalListCard } from "@features/goal/ui/GoalListCard";

export default function GoalsClient() {
  const m = useGoalMeasurements();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingGoal = m.goals.find((goal) => goal.id === searchParams.get("edit")) ?? null;
  const wizardOpen = searchParams.get("new") === "1" || editingGoal != null;
  const requestedStep = Number(searchParams.get("step"));
  const step = Number.isInteger(requestedStep) && requestedStep >= 0 && requestedStep <= 4 ? requestedStep : 0;

  const openWizard = (goal: Goal | null) => {
    clearGoalDraft();
    router.push(goal ? `/goals?edit=${goal.id}` : "/goals?new=1");
  };
  const changeStep = (nextStep: number) => {
    const params = new URLSearchParams();
    if (editingGoal) params.set("edit", editingGoal.id);
    else params.set("new", "1");
    params.set("step", String(nextStep));
    router.push(`/goals?${params}`);
  };

  const save = (goal: Goal) => {
    if (m.goals.some((g) => g.id === goal.id)) m.updateGoal(goal);
    else m.addGoal(goal);
  };

  const campaignNames = m.campaigns.filter((c) => c.status === "live").map((c) => c.name);

  if (wizardOpen) {
    return (
      <GoalWizard
        goal={editingGoal}
        step={step}
        inputs={m.inputs}
        current={m.current}
        marginRate={m.marginRate}
        campaignNames={campaignNames}
        onSave={save}
        onStepChange={changeStep}
        onClose={() => { clearGoalDraft(); router.replace("/goals"); }}
        onOpenTracker={(id) => router.push(`/goals/${id}`)}
      />
    );
  }

  return (
    <div
      className="px-5 sm:px-8 lg:px-12 py-7 lg:py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-6"
      data-screen-label="목표 설정"
    >
      <div className="flex justify-between items-start gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-overline text-[var(--w-fg-neutral)]">
              성과 목표
            </span>
            {m.browseMode && (
              <Chip variant="neutral" size="sm">
                예시
              </Chip>
            )}
          </div>
          {m.goals.length > 0 && (
            <p className="w-body text-[var(--w-fg-neutral)] mt-1 mb-0 max-w-[640px]">
              후행 목표를 세우면 선행지표를 역산해서 추적해드려요. 노출수 같은 허영지표는 목표 후보에 두지 않아요 — 행동으로
              이어지는 지표만 추적해요.
            </p>
          )}
        </div>
        {(m.loading || m.goals.length > 0) && (
          <Button variant="primary" size="md" type="button" onClick={() => openWizard(null)}>
            <Icon name="plus" size={14} /> 목표 세우기
          </Button>
        )}
      </div>

      {m.loading ? (
        <Skeleton className="h-[160px] rounded-2xl" />
      ) : m.goals.length === 0 ? (
        <Card variant="lg" className="py-14 sm:py-[72px] px-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)] grid place-items-center">
            <Icon name="target" size={30} />
          </div>
          <h2 className="w-h2 mt-5 mb-0">아직 목표가 없어요</h2>
          <p className="w-body max-w-[480px] mt-3 mb-0">
            후행 목표를 세우면 도달에 필요한 선행지표를 역산해서 추적해드려요. 노출수처럼 행동으로 이어지지 않는 지표는 목표 후보에 두지 않아요.
          </p>
          <Button className="mt-7" variant="primary" size="md" type="button" onClick={() => openWizard(null)}>
            첫 목표 세우기
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {m.goals.map((goal) => (
            <GoalListCard
              key={goal.id}
              goal={goal}
              current={m.current}
              marginRate={m.marginRate}
              onEdit={() => openWizard(goal)}
              onDelete={() => m.removeGoal(goal.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
