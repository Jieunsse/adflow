"use client";

// 월간 계획 목록 (기능명세 12-1). 브랜드마다 이번 달·다음 달 계획 상태를 보여 준다.
// 대행 브랜드에 이번 달 승인된 계획이 없으면 오늘의 결정 2순위에도 올라간다 (/today, 기능 5).

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import {
  PLAN_STATUS_LABEL,
  monthLabel,
  thisAndNextMonth,
  type MonthlyPlan,
  type PlanStatus,
} from "@entities/monthly-plan/model";

const VARIANT: Record<PlanStatus | "none", ChipVariant> = {
  draft: "neutral",
  requested: "review",
  approved: "success",
  rejected: "neg",
  none: "warn",
};

export default function PlansPage() {
  const { data: session } = useSession();
  const { profiles } = useBrandProfileStorage();
  const months = thisAndNextMonth();

  const q = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("월간 계획을 불러오지 못했어요.");
      return ((await res.json()) as { items: MonthlyPlan[] }).items;
    },
    enabled: !session?.browseMode,
  });
  const plans = q.data ?? [];
  const statusOf = (brandId: string, month: string): PlanStatus | "none" =>
    plans.find((p) => p.brandProfileId === brandId && p.month === month)?.status ?? "none";

  return (
    <div className="px-12 py-9 pb-16 max-w-[960px] w-full mx-auto flex flex-col gap-6" data-screen-label="이번 달 광고 계획">
      <div>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] text-[var(--w-fg-strong)]">이번 달 광고 계획</h1>
        <p className="font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
          고객이 한 달에 한 번 계획과 총예산 상한을 승인해요. 승인된 계획이 없는 달에는 새 실험을 올릴 수 없어요.
        </p>
      </div>

      {session?.browseMode ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">둘러보기에서는 월간 계획을 저장하지 않아요.</Card>
      ) : q.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : q.isError ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">
          월간 계획을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </Card>
      ) : profiles.length === 0 ? (
        <Card className="py-10 px-6 text-center font-medium text-[14px] text-[var(--w-fg-neutral)]">
          브랜드가 아직 없어요. 브랜드 프로필을 먼저 만들어 주세요.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((b) => (
            <Card key={b.id} className="p-5 flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-[15px] text-[var(--w-fg-strong)] min-w-[140px]">{b.name}</span>
              <div className="ml-auto flex gap-4 flex-wrap">
                {months.map((m) => {
                  const s = statusOf(b.id, m);
                  return (
                    <Link
                      key={m}
                      href={`/plans/${encodeURIComponent(b.id)}/${m}`}
                      className="flex items-center gap-2 font-medium text-[13px] text-[var(--w-fg-neutral)]"
                    >
                      {monthLabel(m)}
                      <Chip variant={VARIANT[s]}>{PLAN_STATUS_LABEL[s]}</Chip>
                    </Link>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
