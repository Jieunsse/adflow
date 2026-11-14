"use client";

// 계획 승인 (기능명세 12-3). 승인하면 이 상한 안에서 담당자가 광고를 올린다. 승인한 뒤에는 상한을 줄일 수만 있다.

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { PLAN_STATUS_LABEL, monthLabel, parseBundles, type MonthlyPlan } from "@entities/monthly-plan/model";
import { portalApi, won } from "@entities/portal/api";

const INPUT = "w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] font-medium text-[var(--w-fg-strong)] bg-[var(--w-bg-elevated)]";

export default function PortalPlanPage() {
  const { month } = useParams<{ month: string }>();
  const qc = useQueryClient();
  const showToast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [cap, setCap] = useState("");
  const q = useQuery({ queryKey: ["portal", "plan", month], queryFn: () => portalApi<MonthlyPlan>(`/plans/${month}`) });

  const run = async (op: Promise<unknown>, ok: string) => {
    try {
      await op;
      showToast(ok);
      setRejecting(false);
      await qc.invalidateQueries({ queryKey: ["portal"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "처리하지 못했어요.");
    }
  };

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!q.data) return <Card className="p-6 font-medium text-[14px] text-[var(--w-fg-neutral)]">이 달의 계획을 찾지 못했어요. 담당자가 준비하면 알림으로 알려 드려요.</Card>;
  const p = q.data;
  const bundles = parseBundles(p.bundles);

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="m-0 font-bold text-[24px] text-[var(--w-fg-strong)]">{monthLabel(p.month)} 광고 계획</h1>
        <Chip variant={p.status === "approved" ? "success" : p.status === "rejected" ? "neg" : "review"}>{PLAN_STATUS_LABEL[p.status]}</Chip>
      </div>

      {p.messageToClient && <Card className="p-5 font-medium text-[14px] leading-[1.6] text-[var(--w-fg-strong)] whitespace-pre-wrap">{p.messageToClient}</Card>}

      <Card className="p-5 flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[16px] text-[var(--w-fg-strong)]">이번 달에 할 실험</h2>
        {bundles.length === 0 && <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">적힌 실험 묶음이 없어요.</span>}
        {bundles.map((b, i) => (
          <div key={i} className="flex flex-col md:flex-row md:justify-between gap-1 font-medium text-[14px] border-b border-[var(--w-line-normal)] pb-2">
            <span>{b.goal} · {b.product} · 바꿔 볼 것: {b.axes}</span>
            <span className="text-[var(--w-fg-neutral)]">예상 {won(b.budget)}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-[16px]">
          <span>총예산 상한</span>
          <span>{won(p.budgetCap)}</span>
        </div>
      </Card>

      {p.status === "requested" && (
        <Card className="p-5 flex flex-col gap-3">
          <p className="m-0 font-medium text-[14px] text-[var(--w-fg-strong)]">승인하시면 이 상한 안에서 담당자가 광고를 올려요. 광고비는 Meta에 등록하신 카드로 나가요.</p>
          {rejecting ? (
            <>
              <label htmlFor="reason" className="font-semibold text-[13px]">반려하는 이유</label>
              <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" type="button" onClick={() => setRejecting(false)}>취소</Button>
                <Button variant="primary" type="button" disabled={!reason.trim()} onClick={() => run(portalApi(`/plans/${month}/reject`, "POST", { reason }), "반려했어요. 담당자에게 알려 드렸어요")}>반려하기</Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setRejecting(true)}>반려하기</Button>
              <Button variant="primary" type="button" onClick={() => run(portalApi(`/plans/${month}/approve`, "POST"), "승인했어요")}>승인하기</Button>
            </div>
          )}
        </Card>
      )}

      {p.status === "approved" && (
        <Card className="p-5 flex flex-col gap-3">
          <p className="m-0 font-medium text-[14px] text-[var(--w-fg-strong)]">상한은 바로 줄일 수 있어요. 늘리려면 담당자에게 요청해 주세요.</p>
          <div className="flex flex-col md:flex-row gap-2">
            <label htmlFor="cap" className="sr-only">새 총예산 상한(원)</label>
            <input id="cap" type="number" min={1} placeholder="새 총예산 상한 (원)" value={cap} onChange={(e) => setCap(e.target.value)} className={INPUT} />
            <Button variant="secondary" type="button" disabled={!cap} onClick={() => run(portalApi(`/plans/${month}/cap`, "PUT", { budgetCap: Number(cap) }), "상한을 줄였어요")}>상한 줄이기</Button>
          </div>
        </Card>
      )}

      {p.status === "rejected" && p.rejectReason && (
        <Card className="p-5 font-medium text-[14px] text-[var(--w-fg-neutral)]">반려한 이유 · {p.rejectReason}. 담당자가 계획을 고쳐 다시 보내 드려요.</Card>
      )}
    </>
  );
}
