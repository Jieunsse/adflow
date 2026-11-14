"use client";

// 이번 달 (기능명세 11-1). 승인할 계획이 있으면 맨 위에 보여 주고, 이번 달 광고비와 상한, 진행 중 실험 수,
// 최근 확정된 배운 것, 담당자를 보여 준다.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { portalApi, won, type Overview } from "@entities/portal/api";

export default function PortalHome() {
  const q = useQuery({ queryKey: ["portal", "overview"], queryFn: () => portalApi<Overview>("/overview") });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.isError || !q.data) {
    return <Card className="p-6 font-medium text-[14px] text-[var(--w-fg-neutral)]">{q.error instanceof Error ? q.error.message : "불러오지 못했어요."}</Card>;
  }
  const o = q.data;
  const capReached = o.budgetCap != null && o.monthSpend >= o.budgetCap;

  return (
    <>
      <div>
        <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">{o.brandName}</span>
        <h1 className="m-0 mt-1 font-bold text-[24px] text-[var(--w-fg-strong)]">이번 달</h1>
      </div>

      {o.planStatus === "requested" && (
        <Card className="p-5 flex flex-col md:flex-row md:items-center gap-3 border-[var(--w-primary-normal)]">
          <div className="flex-1">
            <div className="font-bold text-[16px] text-[var(--w-fg-strong)]">이번 달 계획을 확인해 주세요</div>
            <div className="font-medium text-[13px] text-[var(--w-fg-neutral)] mt-1">승인하시면 이 상한 안에서 담당자가 광고를 올려요.</div>
          </div>
          <Link href={`/portal/plans/${o.month}`}><Button variant="primary" type="button">계획 보기</Button></Link>
        </Card>
      )}
      {!o.planStatus && (
        <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">이번 달 계획을 담당자가 준비하고 있어요. 준비되면 여기에서 확인할 수 있어요.</Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-5 flex flex-col gap-1">
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">이번 달 쓴 광고비</span>
          <span className="font-bold text-[20px] text-[var(--w-fg-strong)]">{won(o.monthSpend)}</span>
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
            {o.budgetCap != null ? `상한 ${won(o.budgetCap)}` : "상한 미정"}
            {o.planStatus && o.planStatus !== "requested" && (
              <> · <Link href={`/portal/plans/${o.month}`} className="underline">계획 보기</Link></>
            )}
          </span>
          {capReached && <span className="font-semibold text-[13px] text-[var(--w-status-negative)]">이번 달 예산을 다 썼어요. 더 진행하려면 담당자에게 연락해 주세요.</span>}
        </Card>
        <Card className="p-5 flex flex-col gap-1">
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">진행 중 실험</span>
          <span className="font-bold text-[20px] text-[var(--w-fg-strong)]">{o.runningExperiments}개</span>
          <Link href="/portal/experiments" className="font-medium text-[12px] text-[var(--w-fg-neutral)] underline">실험 보기</Link>
        </Card>
        <Card className="p-5 flex flex-col gap-1">
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">담당자</span>
          <span className="font-bold text-[15px] text-[var(--w-fg-strong)] break-all">{o.managerEmail ?? "곧 정해져요"}</span>
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">문의는 카카오톡 채널로 남겨 주세요.</span>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">최근 배운 것</h2>
        {o.recentLearnings.length === 0 ? (
          <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">아직 확정된 배운 것이 없어요. 실험 결과가 나오면 여기에 쌓여요.</Card>
        ) : (
          o.recentLearnings.map((l) => (
            <Link key={l.id} href="/portal/learnings">
              <Card className="p-4 font-medium text-[14px] text-[var(--w-fg-strong)]">{l.sentence}</Card>
            </Link>
          ))
        )}
      </section>
    </>
  );
}
