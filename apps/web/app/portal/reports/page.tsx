"use client";

// 리포트 목록 (고객 화면). 담당자가 공유한 리포트만 보인다 (정책서 16.1).

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { portalApi, type SharedReport } from "@entities/portal/api";

export default function PortalReports() {
  const q = useQuery({ queryKey: ["portal", "reports"], queryFn: () => portalApi<{ items: SharedReport[] }>("/reports").then((d) => d.items) });
  return (
    <>
      <h1 className="m-0 font-bold text-[24px] text-[var(--w-fg-strong)]">리포트</h1>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (q.data ?? []).length === 0 ? (
        <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">아직 공유받은 리포트가 없어요. 담당자가 공유하면 알림으로 알려 드려요.</Card>
      ) : (
        (q.data ?? []).map((r) => (
          <Link key={r.id} href={`/portal/reports/${r.id}`}>
            <Card className="p-5 flex justify-between font-medium text-[14px] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-alternative)]">
              <span className="font-bold">{r.kind === "weekly" ? "주간" : "월간"} 리포트</span>
              <span className="text-[var(--w-fg-neutral)]">{r.rangeStart} ~ {r.rangeEnd}</span>
            </Card>
          </Link>
        ))
      )}
    </>
  );
}
