"use client";

// 공유받은 리포트 한 건. 성과 → 이유 → 다음 할 일 순서다 (정책서 16.1). 숫자는 공유한 순간의 값이다.

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { deltaPct, formatMetric } from "@entities/insights/period-report";
import { parseMetrics, parseReasons, portalApi, type SharedReport } from "@entities/portal/api";

export default function PortalReport() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["portal", "report", id], queryFn: () => portalApi<SharedReport>(`/reports/${id}`) });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!q.data) return <Card className="p-6 font-medium text-[14px] text-[var(--w-fg-neutral)]">리포트를 찾지 못했어요. 리포트 목록에서 다시 골라 주세요.</Card>;
  const r = q.data;
  const reasons = parseReasons(r);

  return (
    <>
      <div>
        <h1 className="m-0 font-bold text-[24px] text-[var(--w-fg-strong)]">{r.kind === "weekly" ? "주간" : "월간"} 리포트</h1>
        <p className="m-0 mt-1.5 font-medium text-[14px] text-[var(--w-fg-neutral)]">{r.rangeStart} ~ {r.rangeEnd} · 지난 기간과 비교 · 출처 Meta</p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">성과</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {parseMetrics(r).map((m) => {
            const d = deltaPct(m);
            return (
              <Card key={m.key} className="p-4 flex flex-col gap-1">
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">{m.label}</span>
                <span className="font-bold text-[18px] text-[var(--w-fg-strong)]">{formatMetric(m, m.value)}</span>
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">지난 기간 {formatMetric(m, m.previous)}{d != null ? ` · ${d >= 0 ? "+" : ""}${d.toFixed(0)}%` : ""}</span>
              </Card>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">이유</h2>
        {reasons.length === 0 ? (
          <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">이번 기간에는 판정이 끝난 실험이 없었어요.</Card>
        ) : (
          reasons.map((x, i) => <Card key={i} className="p-4 font-medium text-[14px] text-[var(--w-fg-strong)]">{x.sentence}</Card>)
        )}
      </section>
      {r.nextSteps && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">다음 할 일</h2>
          <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-strong)] whitespace-pre-wrap">{r.nextSteps}</Card>
        </section>
      )}
    </>
  );
}
