"use client";

// 진행 중 실험 (기능명세 11-2). 읽기만 한다. 판정 전에는 이기고 있는 쪽을 보여 주지 않는다 (정책서 5.1) —
// 그래서 서버도 성과 숫자를 보내지 않는다.

import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { axisName, portalApi, type PortalExperiment } from "@entities/portal/api";

export default function PortalExperiments() {
  const q = useQuery({ queryKey: ["portal", "experiments"], queryFn: () => portalApi<{ items: PortalExperiment[] }>("/experiments").then((d) => d.items) });
  return (
    <>
      <h1 className="m-0 font-bold text-[24px] text-[var(--w-fg-strong)]">진행 중 실험</h1>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (q.data ?? []).length === 0 ? (
        <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">지금 진행 중인 실험이 없어요.</Card>
      ) : (
        (q.data ?? []).map((e) => (
          <Card key={e.id} className="p-5 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[16px] text-[var(--w-fg-strong)]">{e.productName} · {axisName(e.axis)} 비교</span>
              {e.hypothesis && <span className="font-medium text-[14px] text-[var(--w-fg-strong)]">{e.hypothesis}</span>}
              <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
                {e.launchedAt ? `${new Date(e.launchedAt).toLocaleDateString("ko-KR")} 시작` : "곧 시작"}
                {e.impressionShortfall ? ` · 판정까지 노출 ${e.impressionShortfall.toLocaleString("ko-KR")}회 남았어요` : " · 판정을 기다리고 있어요"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{ label: "지금 소재", v: e.champion }, { label: "새로 시험하는 소재", v: e.challenger }].map(({ label, v }) => (
                <div key={label} className="rounded-xl border border-[var(--w-line-normal)] p-4 flex flex-col gap-1">
                  <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">{label}</span>
                  <span className="font-bold text-[14px] text-[var(--w-fg-strong)]">{v?.headline}</span>
                  <span className="font-medium text-[13px] text-[var(--w-fg-neutral)] whitespace-pre-wrap">{v?.primaryText}</span>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </>
  );
}
