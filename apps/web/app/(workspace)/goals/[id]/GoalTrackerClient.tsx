"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@shared/ui/Skeleton";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import type { Goal } from "@entities/insights/goal";
import { useGoalMeasurements } from "@features/goal/model/useGoalMeasurements";
import { GoalTracker } from "@features/goal/ui/GoalTracker";
import { GoalWizard } from "@features/goal/ui/GoalWizard";

export default function GoalTrackerClient({ goalId }: { goalId: string }) {
  const m = useGoalMeasurements();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);

  const goal = m.goals.find((g) => g.id === goalId) ?? null;

  const save = (next: Goal) => {
    m.updateGoal(next);
    setEditing(false);
  };

  if (editing && goal) {
    return (
      <GoalWizard
        goal={goal}
        step={step}
        inputs={m.inputs}
        current={m.current}
        marginRate={m.marginRate}
        campaignNames={m.campaigns.filter((c) => c.status === "live").map((c) => c.name)}
        onSave={save}
        onStepChange={setStep}
        onClose={() => setEditing(false)}
        onOpenTracker={(id) => {
          setEditing(false);
          router.push(`/goals/${id}`);
        }}
      />
    );
  }

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-7 lg:py-9 pb-16 max-w-[1280px] w-full mx-auto" data-screen-label="목표 추적">
      {m.loading ? (
        <Skeleton className="h-[520px] rounded-2xl" />
      ) : goal == null ? (
        <EmptyState
          icon={<Icon name="target" size={26} />}
          title="이 목표를 찾지 못했어요"
          desc="지워졌거나 다른 브랜드 프로필의 목표일 수 있어요."
          action={
            <Link href="/goals" className="no-underline">
              <Button variant="primary" size="md" type="button">
                목표 목록으로
              </Button>
            </Link>
          }
        />
      ) : (
        <GoalTracker goal={goal} m={m} onEdit={() => setEditing(true)} />
      )}
    </div>
  );
}
