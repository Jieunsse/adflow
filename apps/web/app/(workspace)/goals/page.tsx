"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import Icon from "@shared/ui/Icon";
import { fmtKRW } from "@shared/lib/format";
import { useGoalsStorage } from "@features/goal/model/useGoalsStorage";
import { GoalSetupForm } from "@features/goal/ui/GoalSetupForm";
import { GoalCard } from "@features/goal/ui/GoalCard";
import type { Goal, LeadMetric, LeadMetricKind } from "@entities/insights/goal";
import { splitWindow, derivePeriodKpis, deriveConversionSummary } from "@entities/insights/period-kpis";
import type { AccountDailyPoint } from "@entities/insights/account-trend";
import { listBrowse } from "@entities/campaign/browse/store";
import { seedAutoPilotDemo } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import type { CampaignSummary } from "@/lib/meta-ads";

const PERIOD_DAYS = 30;
const TREND_DAYS = 60;

async function fetchCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch(`/api/campaigns?period=30d`);
  if (res.status === 401) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "캠페인을 불러오지 못했어요");
  return (data.campaigns ?? []) as CampaignSummary[];
}

async function fetchTrend(): Promise<AccountDailyPoint[]> {
  const res = await fetch(`/api/dashboard/trend?days=${TREND_DAYS}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.daily ?? []) as AccountDailyPoint[];
}

export default function GoalsPage() {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;

  const { goals, marginRate, addGoal, updateGoal, removeGoal } = useGoalsStorage(browseMode);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [browseRows, setBrowseRows] = useState<CampaignSummary[]>([]);
  useEffect(() => {
    if (!browseMode) return;
    seedAutoPilotDemo();
    setBrowseRows(listBrowse().map(browseCampaignToSummary));
  }, [browseMode]);

  const campaignsQ = useQuery({
    queryKey: ["campaigns", "30d"],
    queryFn: fetchCampaigns,
    enabled: !!session?.adAccountId || browseMode,
    staleTime: 60_000,
  });
  const trendQ = useQuery({
    queryKey: ["dashboard", "trend", TREND_DAYS],
    queryFn: fetchTrend,
    enabled: !!session?.adAccountId || browseMode,
    staleTime: 5 * 60_000,
  });

  const campaigns = campaignsQ.data ?? [];
  const tableCampaigns = browseMode ? [...browseRows, ...campaigns] : campaigns;
  const dailyAll = trendQ.data ?? [];

  const { current: dailyCurrent, previous: dailyPrevious } = useMemo(
    () => splitWindow(dailyAll, PERIOD_DAYS),
    [dailyAll],
  );

  const periodKpis = useMemo(() => derivePeriodKpis(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);
  const conversion = useMemo(() => deriveConversionSummary(tableCampaigns), [tableCampaigns]);

  const measuredAov = conversion && conversion.conversionCount > 0 ? conversion.conversionValue / conversion.conversionCount : undefined;
  // 계정 전체 CVR = ΣpurchaseCount / ΣlinkClick — deriveConversionSummary 와 동일한 합산 패턴(캠페인별 평균 아님).
  const measuredCvr = useMemo(() => {
    const measured = tableCampaigns.filter((c) => c.linkClick != null && c.purchaseCount != null);
    if (measured.length === 0) return undefined;
    const totalLinkClick = measured.reduce((s, c) => s + (c.linkClick ?? 0), 0);
    const totalPurchase = measured.reduce((s, c) => s + (c.purchaseCount ?? 0), 0);
    return totalLinkClick > 0 ? totalPurchase / totalLinkClick : undefined;
  }, [tableCampaigns]);
  const measuredCpm = dailyCurrent.length > 0 ? periodKpis.cpm.value : undefined;

  const [manualAov, setManualAov] = useState("");
  const [manualCvr, setManualCvr] = useState("");
  const [manualCpm, setManualCpm] = useState("");

  const aov = measuredAov ?? (manualAov.trim() !== "" ? Number(manualAov) : undefined);
  const cvr = measuredCvr ?? (manualCvr.trim() !== "" ? Number(manualCvr) / 100 : undefined);
  const cpm = measuredCpm ?? (manualCpm.trim() !== "" ? Number(manualCpm) : undefined);

  const guardrailInputs = useMemo(() => ({ aov, cvr, cpm, marginRate }), [aov, cvr, cpm, marginRate]);

  const activeCampaignCount = useMemo(
    () => tableCampaigns.filter((c) => c.status === "live").length,
    [tableCampaigns],
  );
  const totalDailyBudget = useMemo(() => {
    const active = tableCampaigns.filter((c) => c.status === "live" && c.dailyBudget != null);
    if (active.length === 0) return null;
    return active.reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
  }, [tableCampaigns]);
  const periodCtr = dailyCurrent.length > 0 ? periodKpis.ctr.value : null;

  const loading = campaignsQ.isLoading || trendQ.isLoading;

  const openAddForm = () => {
    setEditingGoal(null);
    setFormOpen(true);
  };
  const openEditForm = (goal: Goal) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditingGoal(null);
  };
  const saveGoal = (goal: Goal) => {
    if (editingGoal) updateGoal(goal);
    else addGoal(goal);
    closeForm();
  };
  const updateLead = (goalId: string, lead: LeadMetric) => {
    const target = goals.find((g) => g.id === goalId);
    if (!target) return;
    const nextLeads = [...target.leads.filter((l) => l.kind !== lead.kind), lead];
    updateGoal({ ...target, leads: nextLeads });
  };
  const resetLead = (goalId: string, kind: LeadMetricKind) => {
    const target = goals.find((g) => g.id === goalId);
    if (!target) return;
    updateGoal({ ...target, leads: target.leads.filter((l) => l.kind !== kind) });
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-6" data-screen-label="목표 설정">
      <div className="flex justify-between items-center gap-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">목표 설정</span>
              {browseMode && <Chip variant="neutral" size="sm">예시</Chip>}
            </div>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
              후행 목표를 세우면 선행지표를 역산해서 추적해드려요. 노출수 같은 허영지표는 목표 후보에 두지 않아요 — 행동으로 이어지는 지표만 추적해요.
            </p>
          </div>
        </div>
        {!formOpen && (
          <Button variant="primary" size="sm" type="button" onClick={openAddForm}>
            <Icon name="plus" size={14} /> 목표 추가
          </Button>
        )}
      </div>

      {formOpen && (
        <GoalSetupForm goal={editingGoal} marginRate={marginRate} onSave={saveGoal} onCancel={closeForm} />
      )}

      {loading ? (
        <Skeleton className="h-[160px] rounded-2xl" />
      ) : (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">역산 파라미터</h2>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
              실측이 있으면 자동으로 채우고, 없으면 직접 입력할 수 있어요.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <ParamField
              label="AOV (객단가)"
              measured={measuredAov}
              measuredDisplay={measuredAov != null ? fmtKRW(Math.round(measuredAov)) : undefined}
              manualValue={manualAov}
              onManualChange={setManualAov}
              suffix="원"
            />
            <ParamField
              label="CVR (전환율)"
              measured={measuredCvr}
              measuredDisplay={measuredCvr != null ? `${(measuredCvr * 100).toFixed(2)}%` : undefined}
              manualValue={manualCvr}
              onManualChange={setManualCvr}
              suffix="%"
            />
            <ParamField
              label="CPM"
              measured={measuredCpm}
              measuredDisplay={measuredCpm != null ? fmtKRW(Math.round(measuredCpm)) : undefined}
              manualValue={manualCpm}
              onManualChange={setManualCpm}
              suffix="원"
            />
          </div>
        </Card>
      )}

      {goals.length === 0 ? (
        <Card variant="quiet" className="flex flex-col items-center gap-3 py-12 text-center">
          <Icon name="target" size={28} className="text-[var(--w-fg-alternative)]" />
          <div>
            <div className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">아직 목표가 없어요</div>
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">
              후행 목표를 세우면 필요한 선행지표를 역산해서 보여드려요.
            </div>
          </div>
          <Button variant="primary" size="sm" type="button" onClick={openAddForm}>첫 목표 세우기</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              inputs={guardrailInputs}
              current={{ roas: conversion?.roas ?? null, cpa: conversion?.cpa ?? null }}
              marginRate={marginRate}
              activeCampaignCount={activeCampaignCount}
              totalDailyBudget={totalDailyBudget}
              periodCtr={periodCtr}
              onEdit={() => openEditForm(goal)}
              onDelete={() => removeGoal(goal.id)}
              onUpdateLead={updateLead}
              onResetLead={resetLead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ParamField({
  label, measured, measuredDisplay, manualValue, onManualChange, suffix,
}: {
  label: string;
  measured: number | undefined;
  measuredDisplay: string | undefined;
  manualValue: string;
  onManualChange: (v: string) => void;
  suffix: string;
}) {
  const hasMeasured = measured != null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">{label}</span>
        <Chip variant={hasMeasured ? "accent" : "neutral"} size="sm">{hasMeasured ? "실측" : "직접 입력"}</Chip>
      </div>
      {hasMeasured ? (
        <span className="font-bold text-[18px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{measuredDisplay}</span>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            value={manualValue}
            onChange={(e) => onManualChange(e.target.value)}
            placeholder="—"
            className="w-24 px-2.5 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[16px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] text-right focus:outline-none focus:border-[var(--w-focus-ring)]"
          />
          <span className="font-semibold text-[13px] text-[var(--w-fg-neutral)]">{suffix}</span>
        </div>
      )}
    </div>
  );
}
