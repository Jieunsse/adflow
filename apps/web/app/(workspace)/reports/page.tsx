"use client";

// 성과 리포트 (기능명세 6-1). 성과 → 이유 → 다음 할 일 순서로 한 기간을 정리한다 (정책서 16.1).
// 성과는 지금 브랜드의 광고 계정 숫자로만 계산하고(AI 없음), 이유는 이 기간에 확정된 배운 것만 쓴다.
// "고객에게 공유"를 누르면 지금 숫자를 그대로 남겨 고객 화면에 열고, 카카오톡 채널로 보낼 링크를 복사한다.
// 다음 실험 제안은 오늘의 결정 화면에 있다.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import type { AccountDailyPoint } from "@entities/insights/account-trend";
import {
  buildPeriodReport,
  deltaPct,
  formatMetric,
  reportRanges,
  toReportCsv,
  type ReportKind,
} from "@entities/insights/period-report";
import { PLAN_STATUS_LABEL, monthLabel, parseBundles, type MonthlyPlan } from "@entities/monthly-plan/model";

type Learning = { id: string; tournamentId: string; sentence?: string; status: string; decidedAt?: string; roundIndex: number; productName?: string };

export default function ReportsPage() {
  const { data: session } = useSession();
  const { activeId, profiles } = useBrandProfileStorage();
  const brand = profiles.find((p) => p.id === activeId);
  const [kind, setKind] = useState<ReportKind>("weekly");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const ranges = useMemo(() => reportRanges(kind, today), [kind, today]);
  const real = !!session && !session.browseMode;
  const showToast = useToast();
  const [sharing, setSharing] = useState(false);

  const trend = useQuery({
    queryKey: ["report-trend"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/trend?days=95");
      if (!res.ok) throw new Error("성과를 불러오지 못했어요.");
      return ((await res.json()) as { daily: AccountDailyPoint[] }).daily;
    },
    enabled: !!session,
  });
  const learnings = useQuery({
    queryKey: ["learnings", activeId],
    queryFn: async () => {
      const res = await fetch(`/api/learnings?brandProfileId=${encodeURIComponent(activeId!)}`);
      return res.ok ? ((await res.json()) as { items: Learning[] }).items : [];
    },
    enabled: real && !!activeId,
  });
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      return res.ok ? ((await res.json()) as { items: MonthlyPlan[] }).items : [];
    },
    enabled: real,
  });

  const metrics = useMemo(
    () => (trend.data ? buildPeriodReport(trend.data, ranges, brand?.marginRate) : []),
    [trend.data, ranges, brand?.marginRate],
  );
  // 이유 — 이 기간에 확정한 배운 것만 (정책서 16.1).
  const reasons = (learnings.data ?? []).filter(
    (l) => l.status === "confirmed" && l.decidedAt && l.decidedAt.slice(0, 10) >= ranges.current.start && l.decidedAt.slice(0, 10) <= ranges.current.end,
  );
  const nextMonth = (() => {
    const d = new Date(today + "T00:00:00Z");
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
  })();
  const plan = (plans.data ?? []).find((p) => p.brandProfileId === activeId && p.month === nextMonth);

  const share = async () => {
    if (!activeId) return;
    setSharing(true);
    const nextSteps = plan
      ? `${monthLabel(nextMonth)} 계획 · ${PLAN_STATUS_LABEL[plan.status]} · 총예산 상한 ${plan.budgetCap ? `${plan.budgetCap.toLocaleString("ko-KR")}원` : "미정"}\n` +
        parseBundles(plan.bundles).map((b) => `· ${b.goal} / ${b.product} / ${b.axes}`).join("\n")
      : undefined;
    const res = await fetch("/api/reports/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandProfileId: activeId,
        kind,
        rangeStart: ranges.current.start,
        rangeEnd: ranges.current.end,
        metricsJson: JSON.stringify(metrics),
        reasonsJson: JSON.stringify(reasons.map((l) => ({ sentence: l.sentence, tournamentId: l.tournamentId, roundIndex: l.roundIndex }))),
        nextSteps,
      }),
    }).catch(() => null);
    setSharing(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      showToast(data?.error ?? "공유하지 못했어요. 잠시 뒤 다시 해 주세요.");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    const link = `${window.location.origin}/portal/reports/${id}`;
    await navigator.clipboard?.writeText(link).catch(() => undefined);
    showToast("고객에게 공유했어요. 카카오톡 채널로 보낼 링크를 복사했어요");
  };

  const downloadCsv = () => {
    const blob = new Blob(["﻿" + toReportCsv(metrics, ranges.current)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `adflow-report-${ranges.current.start}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[960px] w-full mx-auto flex flex-col gap-6" data-screen-label="성과 리포트">
      <div className="flex justify-between items-end gap-4">
        <div>
          <span className="font-semibold text-[11px] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">{brand?.name ?? "브랜드"}</span>
          <h1 className="m-0 mt-1 font-bold text-[28px] text-[var(--w-fg-strong)]">성과 리포트</h1>
          <p className="font-medium text-[14px] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
            {ranges.current.start} ~ {ranges.current.end} · 지난 기간({ranges.previous.start} ~ {ranges.previous.end})과 비교해요. 출처는 Meta예요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={kind === "weekly" ? "primary" : "secondary"} type="button" onClick={() => setKind("weekly")}>주간</Button>
          <Button variant={kind === "monthly" ? "primary" : "secondary"} type="button" onClick={() => setKind("monthly")}>월간</Button>
          <Button variant="secondary" type="button" disabled={metrics.length === 0} onClick={downloadCsv}>CSV 내려받기</Button>
          <Button variant="primary" type="button" disabled={!real || sharing || metrics.length === 0} onClick={share}>고객에게 공유</Button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">성과</h2>
        {trend.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : trend.isError ? (
          <Card className="py-6 px-5 font-medium text-[13px] text-[var(--w-fg-neutral)]">성과를 불러오지 못했어요. 광고 계정 연결을 확인한 뒤 다시 열어 주세요.</Card>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {metrics.map((m) => {
              const d = deltaPct(m);
              return (
                <Card key={m.key} className="p-4 flex flex-col gap-1">
                  <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">{m.label}</span>
                  <span className="font-bold text-[20px] text-[var(--w-fg-strong)]">{formatMetric(m, m.value)}</span>
                  <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
                    지난 기간 {formatMetric(m, m.previous)}{d != null ? ` · ${d >= 0 ? "+" : ""}${d.toFixed(0)}%` : ""}
                  </span>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">이유</h2>
        {reasons.length === 0 ? (
          <Card className="py-6 px-5 font-medium text-[13px] text-[var(--w-fg-neutral)]">
            이번 기간에 확정한 배운 것이 없어요. 판정이 끝난 실험이 없었거나, 초안을 아직 확정하지 않았어요.{" "}
            <Link href="/learnings" className="underline">광고 노하우 보기</Link>
          </Card>
        ) : (
          reasons.map((l) => (
            <Card key={l.id} className="p-4 flex flex-col gap-1">
              <span className="font-medium text-[14px] text-[var(--w-fg-strong)]">{l.sentence}</span>
              <Link href={`/ab-tests/${l.tournamentId}`} className="font-medium text-[12px] text-[var(--w-fg-neutral)] underline">
                근거 · {l.productName ?? "실험"} 실험 {l.roundIndex}
              </Link>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-bold text-[18px] text-[var(--w-fg-strong)]">다음 할 일</h2>
        <Card className="p-4 flex flex-col gap-1 font-medium text-[14px] text-[var(--w-fg-strong)]">
          {plan ? (
            <>
              <span>{monthLabel(nextMonth)} 계획 · {PLAN_STATUS_LABEL[plan.status]} · 총예산 상한 {plan.budgetCap ? `${plan.budgetCap.toLocaleString("ko-KR")}원` : "미정"}</span>
              {parseBundles(plan.bundles).map((b, i) => (
                <span key={i} className="text-[13px] text-[var(--w-fg-neutral)]">· {b.goal} / {b.product} / {b.axes}</span>
              ))}
            </>
          ) : (
            <span>
              {monthLabel(nextMonth)} 계획이 아직 없어요. <Link href="/plans" className="underline">이번 달 광고 계획</Link>에서 만들어 주세요.
            </span>
          )}
        </Card>
      </section>
    </div>
  );
}
