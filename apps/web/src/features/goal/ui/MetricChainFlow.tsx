"use client";

import { useState } from "react";
import type { Goal, GoalMetric, LeadMetric, LeadMetricKind } from "@entities/insights/goal";
import { deriveLeadChain, type GuardrailInputs } from "@entities/insights/goal";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import Icon from "@shared/ui/Icon";
import { fmtKRW } from "@shared/lib/format";

const LEAD_LABEL: Record<LeadMetricKind, string> = {
  "cpc-max": "CPC 상한",
  "ctr-min": "CTR 하한",
};

function leadHeadline(lead: LeadMetric): string {
  if (lead.value == null) return "—";
  if (lead.kind === "cpc-max") return `${fmtKRW(Math.round(lead.value))} 이하`;
  return `${(lead.value * 100).toFixed(2)}% 이상`;
}

function metricLabel(metric: GoalMetric): string {
  if (metric === "cpa") return "CPA";
  return "ROAS";
}

function formatLagValue(metric: GoalMetric, value: number): string {
  return metric === "cpa" ? fmtKRW(Math.round(value)) : `${value.toFixed(2)}x`;
}

export interface MetricChainFlowProps {
  goal: Goal;
  inputs: GuardrailInputs;
  activeCampaignCount: number;
  totalDailyBudget: number | null;
  periodCtr: number | null;
  current: { roas?: number | null; cpa?: number | null };
  bepTarget: number | null;
  onUpdateLead: (lead: LeadMetric) => void;
  onResetLead: (kind: LeadMetricKind) => void;
}

export function MetricChainFlow({
  goal,
  inputs,
  activeCampaignCount,
  totalDailyBudget,
  periodCtr,
  current,
  bepTarget,
  onUpdateLead,
  onResetLead,
}: MetricChainFlowProps) {
  const derived = deriveLeadChain(goal.lag, inputs);
  const displayLeads = derived.map((d) => {
    const custom = goal.leads.find((l) => l.kind === d.kind && l.source === "custom");
    return custom ?? d;
  });

  const lagTarget = goal.lag.metric === "contribution" ? bepTarget : goal.lag.target;
  const lagCurrent = goal.lag.metric === "cpa" ? current.cpa ?? null : current.roas ?? null;

  return (
    <div className="grid grid-cols-4 gap-3">
      <ChainColumn overline="인풋">
        <Card variant="quiet" className="flex flex-col gap-1.5">
          <span className="font-bold text-[16px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
            활성 캠페인 {activeCampaignCount}개
          </span>
          <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-neutral)]">
            일예산 합계 {totalDailyBudget != null ? fmtKRW(totalDailyBudget) : "실측이 아직 없어요"}
          </span>
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)] mt-1">
            지금 통제할 수 있는 행동이에요
          </span>
        </Card>
      </ChainColumn>

      <ChainColumn overline="아웃풋">
        <Card variant="quiet" className="flex flex-col gap-1.5">
          {periodCtr != null ? (
            <span className="font-bold text-[16px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
              기간 CTR {periodCtr.toFixed(2)}%
            </span>
          ) : (
            <span className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-alternative)]">
              실측이 아직 없어요
            </span>
          )}
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)] mt-1">
            행동의 결과예요
          </span>
        </Card>
      </ChainColumn>

      <ChainColumn overline="선행지표">
        <div className="flex flex-col gap-2">
          {displayLeads.map((lead) => (
            <LeadCard key={lead.kind} lead={lead} onUpdate={onUpdateLead} onReset={onResetLead} />
          ))}
        </div>
      </ChainColumn>

      <ChainColumn overline="후행 목표">
        <Card variant="quiet" className="flex flex-col gap-1.5">
          <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-alternative)]">
            {goal.name}
          </span>
          {lagTarget == null ? (
            <span className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-alternative)]">
              마진율이 아직 설정되지 않았어요
            </span>
          ) : (
            <span className="font-bold text-[16px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
              목표 {formatLagValue(goal.lag.metric, lagTarget)}
            </span>
          )}
          <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-neutral)]">
            현재 {lagCurrent != null ? formatLagValue(goal.lag.metric, lagCurrent) : "데이터 대기"}
          </span>
        </Card>
      </ChainColumn>
    </div>
  );
}

function ChainColumn({ overline, children }: { overline: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">
        {overline}
      </span>
      {children}
    </div>
  );
}

function LeadCard({
  lead,
  onUpdate,
  onReset,
}: {
  lead: LeadMetric;
  onUpdate: (lead: LeadMetric) => void;
  onReset: (kind: LeadMetricKind) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => (lead.value != null ? String(lead.kind === "ctr-min" ? lead.value * 100 : Math.round(lead.value)) : ""));

  const unavailable = lead.value == null;
  const isCustom = lead.source === "custom";

  const save = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) return;
    const value = lead.kind === "ctr-min" ? n / 100 : n;
    onUpdate({ kind: lead.kind, value, source: "custom" });
    setEditing(false);
  };

  return (
    <Card variant="quiet" className="flex flex-col gap-1.5" style={unavailable ? { opacity: 0.6 } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-alternative)]">
          {LEAD_LABEL[lead.kind]}
        </span>
        <div className="flex items-center gap-1.5">
          <Chip variant={isCustom ? "accent" : "neutral"} size="sm">{isCustom ? "직접 지정" : "역산"}</Chip>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[var(--w-fg-alternative)] hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)]"
            aria-label="선행지표 직접 입력"
          >
            <Icon name="edit" size={13} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={lead.kind === "ctr-min" ? "예: 1.20" : "예: 500"}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[15px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] text-right focus:outline-none focus:border-[var(--w-focus-ring)]"
          />
          <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)] shrink-0">
            {lead.kind === "ctr-min" ? "%" : "원"}
          </span>
          <button
            type="button"
            onClick={save}
            className="shrink-0 font-semibold text-[12px] text-[var(--w-primary-press)] hover:underline"
          >
            적용
          </button>
        </div>
      ) : unavailable ? (
        <div className="flex items-center gap-1.5">
          <Icon name="info" size={13} className="shrink-0 text-[var(--w-fg-alternative)]" />
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)]">{lead.reason}</span>
        </div>
      ) : (
        <span className="font-bold text-[16px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
          {leadHeadline(lead)}
        </span>
      )}

      {isCustom && !editing && (
        <button
          type="button"
          onClick={() => onReset(lead.kind)}
          className="self-start font-semibold text-[11px] text-[var(--w-fg-alternative)] hover:text-[var(--w-fg-neutral)] hover:underline"
        >
          역산값으로 되돌리기
        </button>
      )}
    </Card>
  );
}
