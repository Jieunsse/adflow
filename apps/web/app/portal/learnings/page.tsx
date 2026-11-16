"use client";

// 배운 것 (고객 화면). 담당자가 확정한 것만 보인다 (기능 4).

import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { axisName, portalApi, type PortalLearning } from "@entities/portal/api";

export default function PortalLearnings() {
  const q = useQuery({ queryKey: ["portal", "learnings"], queryFn: () => portalApi<{ items: PortalLearning[] }>("/learnings").then((d) => d.items) });
  return (
    <>
      <div>
        <h1 className="m-0 font-bold text-[24px] text-[var(--w-fg-strong)]">배운 것</h1>
        <p className="m-0 mt-1.5 font-medium text-[14px] text-[var(--w-fg-neutral)]">실험에서 확인한 것이에요. 다음 광고를 만들 때 이 내용을 써요.</p>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (q.data ?? []).length === 0 ? (
        <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">아직 확정된 배운 것이 없어요. 실험 결과가 나오면 여기에 쌓여요.</Card>
      ) : (
        (q.data ?? []).map((l) => (
          <Card key={l.id} className="p-5 flex flex-col gap-1">
            <span className="font-medium text-[15px] leading-[1.6] text-[var(--w-fg-strong)]">{l.sentence}</span>
            <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
              {l.productName ?? "실험"} · {axisName(l.axis)} · {l.decidedAt ? new Date(l.decidedAt).toLocaleDateString("ko-KR") : ""}
            </span>
          </Card>
        ))
      )}
    </>
  );
}
