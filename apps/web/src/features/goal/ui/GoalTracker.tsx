"use client";

// 목표 추적 — 저장 직후부터 보이는 화면. 후행 목표 진척(도넛) + 선행지표 4개 + 이번 주 제안.
// 선행지표 목표치는 목표를 세운 시점의 스냅샷에서 역산해 고정한다(GoalWizard 가 baselineInputs 로 남긴다).

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Goal } from "@entities/insights/goal";
import {
  deriveBackcastMap,
  deriveGoalPace,
  deriveLeadSeries,
  lagTargetOf,
  leadProgressPct,
  type BackcastKind,
  type BackcastRow,
} from "@entities/insights/backcast";
import { deriveActionQueue, type ActionButton } from "@entities/insights/action-queue";
import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import Icon from "@shared/ui/Icon";
import { MiniBars } from "@shared/ui/primitives";
import { cn } from "@shared/lib/cn";
import type { GoalMeasurements } from "../model/useGoalMeasurements";
import { backcastShortLabel, fmtBackcastValue, fmtLagValue, lagMetricLabel, lagUnit } from "./BackcastPanel";

export function GoalTracker({
  goal,
  m,
  onEdit,
}: {
  goal: Goal;
  m: GoalMeasurements;
  onEdit: () => void;
}) {
  const router = useRouter();
  const metric = goal.lag.metric;
  const unit = lagUnit(metric);
  const periodDays = goal.periodDays ?? 30;

  // 기준선 스냅샷으로 역산 — 목표치가 오늘 실측을 따라다니지 않게 고정한다.
  const frozen = useMemo(
    () =>
      deriveBackcastMap(
        goal.lag,
        metric === "cpa" ? { cpa: goal.baseline ?? null } : { roas: goal.baseline ?? null },
        goal.baselineInputs ?? {},
        m.marginRate,
      ),
    [goal.lag, goal.baseline, goal.baselineInputs, metric, m.marginRate],
  );

  const lagTarget = lagTargetOf(goal.lag, m.marginRate);
  const lagNow = metric === "cpa" ? m.current.cpa : m.current.roas;

  const pace = useMemo(
    () =>
      deriveGoalPace({
        metric,
        baseline: goal.baseline ?? null,
        currentValue: lagNow ?? null,
        target: lagTarget,
        createdAt: goal.createdAt,
        periodDays,
        now: new Date(),
      }),
    [metric, goal.baseline, lagNow, lagTarget, goal.createdAt, periodDays],
  );

  const series = useMemo(() => deriveLeadSeries(m.dailyCurrent), [m.dailyCurrent]);
  const liveValue: Record<BackcastKind, number | null> = {
    ctr: m.inputs.ctr ?? null,
    cvr: m.inputs.cvr ?? null,
    aov: m.inputs.aov ?? null,
    cpc: m.inputs.cpc ?? null,
  };

  const actions = useMemo(
    () =>
      deriveActionQueue({
        campaigns: m.campaigns,
        marginRate: m.marginRate,
        totalSpend: m.totalSpend,
        roasDeltaPct: m.roasDeltaPct,
      }),
    [m.campaigns, m.marginRate, m.totalSpend, m.roasDeltaPct],
  );

  const onAction = (button: ActionButton) => {
    const t = button.target;
    if (t.kind === "campaign") router.push(`/campaigns/${t.id}`);
    else if (t.kind === "campaigns") router.push("/campaigns");
    else if (t.kind === "margin") router.push("/brand-profile");
    else router.push("/settings");
  };

  const trackedLeads = frozen.rows.filter((r) => r.target != null).length;

  return (
    <div className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl overflow-hidden">
      <div className="px-6 sm:px-8 pt-5 pb-5 border-b border-[var(--w-line-alternative)] flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-[13px] text-[var(--w-fg-neutral)]">
            <Link href="/goals" className="hover:underline text-inherit no-underline">
              성과 목표
            </Link>
            <Icon name="arrow-right" size={13} />
            <span className="font-semibold text-[var(--w-fg-normal)] truncate">{goal.name}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="m-0 font-bold text-[22px] sm:text-[26px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">
              {lagMetricLabel(metric)} {fmtLagValue(metric, lagTarget)}
              {unit}
              {metric === "cpa" ? " 이하로" : "까지"}
            </h1>
            {pace.ahead != null && (
              <Chip variant={pace.ahead ? "success" : "warn"} dot size="sm">
                {pace.ahead ? "경로보다 앞서요" : "경로보다 뒤처져요"}
              </Chip>
            )}
            {pace.daysLeft != null && (
              <Chip variant="neutral" size="sm">
                D-{pace.daysLeft}
              </Chip>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="md" type="button" onClick={onEdit}>
            목표 수정
          </Button>
          <Button variant="primary" size="md" type="button" onClick={() => router.push("/dashboard")}>
            주간 리포트 보기
          </Button>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-7 items-start">
        <LagProgressCard
          metric={metric}
          baseline={goal.baseline ?? null}
          now={lagNow ?? null}
          target={lagTarget}
          pace={pace}
        />

        <div className="flex flex-col gap-6 min-w-0">
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.015em] text-[var(--w-fg-strong)]">
                선행지표 {trackedLeads}개
              </h2>
              <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">매일 새벽 4시에 갱신돼요</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {frozen.rows.map((row) => (
                <LeadCard
                  key={row.kind}
                  row={row}
                  now={liveValue[row.kind]}
                  expectedPct={pace.expectedPct}
                  series={series[row.kind]}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.015em] text-[var(--w-fg-strong)]">
                이번 주 제안 {actions.length}개
              </h2>
              <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">효과가 큰 순서로 정렬했어요</span>
            </div>
            {actions.length === 0 ? (
              <div className="flex items-center gap-3 px-[18px] py-4 rounded-2xl bg-[var(--w-bg-alternative)]">
                <span className="w-9 h-9 shrink-0 rounded-[10px] grid place-items-center bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)]">
                  <Icon name="check" size={18} />
                </span>
                <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
                  지금 당장 손댈 곳은 없어요. 선행지표가 경로를 벗어나면 여기에 제안이 올라와요.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {actions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 px-[18px] py-4 rounded-2xl bg-[var(--w-bg-alternative)]"
                  >
                    <div className="flex-1 min-w-0 flex items-start sm:items-center gap-3.5">
                      <span
                        className="w-9 h-9 shrink-0 rounded-[10px] grid place-items-center"
                        style={
                          item.accent === "negative"
                            ? { background: "var(--w-status-negative-soft)", color: "var(--w-status-negative)" }
                            : item.accent === "primary"
                              ? { background: "var(--w-primary-soft)", color: "var(--w-primary-press)" }
                              : { background: "var(--w-bg-neutral)", color: "var(--w-fg-neutral)" }
                        }
                      >
                        <Icon name={item.accent === "negative" ? "warn" : item.accent === "primary" ? "trend-up" : "info"} size={18} />
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="font-bold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">{item.title}</span>
                        <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">{item.body}</span>
                      </div>
                    </div>
                    {item.buttons[0] && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        className="shrink-0 self-start sm:self-auto"
                        onClick={() => onAction(item.buttons[0])}
                      >
                        {item.buttons[0].label}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-[var(--w-bg-alternative)]">
            <Icon name="info" size={16} className="shrink-0 mt-0.5 text-[var(--w-fg-alternative)]" />
            <span className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]">
              진척 판정은 최근 30일 실측 기준이에요. 노출수·도달수는 여전히 추적하지 않아요.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LagProgressCard({
  metric,
  baseline,
  now,
  target,
  pace,
}: {
  metric: Goal["lag"]["metric"];
  baseline: number | null;
  now: number | null;
  target: number | null;
  pace: ReturnType<typeof deriveGoalPace>;
}) {
  const unit = lagUnit(metric);
  const pct = pace.progressPct ?? 0;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center gap-5"
      style={{ background: "var(--w-surface-narrative)", color: "var(--w-on-narrative)" }}
    >
      <span className="self-start font-bold text-[13px] leading-none" style={{ color: "var(--w-on-narrative-alternative)" }}>
        후행 목표 진척
      </span>

      <div
        className="relative w-[196px] h-[196px] rounded-full grid place-items-center"
        style={{
          background: `conic-gradient(var(--w-on-narrative-primary) 0turn ${pct / 100}turn, var(--w-surface-narrative-fill) ${pct / 100}turn 1turn)`,
        }}
      >
        <div
          className="w-[158px] h-[158px] rounded-full flex flex-col items-center justify-center gap-0.5"
          style={{ background: "var(--w-surface-narrative)" }}
        >
          <span className="font-semibold text-[12px] leading-none" style={{ color: "var(--w-on-narrative-alternative)" }}>
            현재 {lagMetricLabel(metric)}
          </span>
          <span className="font-extrabold text-[40px] leading-[1.05] tracking-[-0.035em] text-white [font-variant-numeric:tabular-nums]">
            {fmtLagValue(metric, now)}
            {unit}
          </span>
          <span className="font-semibold text-[12px] leading-none" style={{ color: "var(--w-on-narrative-primary)" }}>
            {pace.progressPct == null ? "실측을 기다리는 중" : `목표까지 ${Math.round(pace.progressPct)}% 왔어요`}
          </span>
        </div>
      </div>

      <div className="w-full flex flex-col gap-2">
        <div
          className="flex justify-between font-medium text-[12px] [font-variant-numeric:tabular-nums]"
          style={{ color: "var(--w-on-narrative-alternative)" }}
        >
          <span>
            시작 {fmtLagValue(metric, baseline)}
            {unit}
          </span>
          <span>
            목표 {fmtLagValue(metric, target)}
            {unit}
          </span>
        </div>
        <div className="relative h-2 rounded-full" style={{ background: "var(--w-surface-narrative-fill)" }}>
          <span
            className="absolute left-0 top-0 bottom-0 rounded-full"
            style={{ width: `${pct}%`, background: "var(--w-on-narrative-primary)" }}
          />
          {pace.expectedPct != null && (
            <span
              className="absolute -top-1 -bottom-1 w-0.5 rounded-sm"
              style={{ left: `${pace.expectedPct}%`, background: "var(--w-on-narrative)" }}
            />
          )}
        </div>
        <span className="font-medium text-[12px] leading-[1.5]" style={{ color: "var(--w-on-narrative-neutral)" }}>
          {pace.expectedPct == null || pace.progressPct == null ? (
            "목표를 세운 시점의 실측이 없어 경로 비교는 아직 못 해요."
          ) : (
            <>
              흰 선은 오늘까지의 예상 경로예요. 지금{" "}
              <strong style={{ color: pace.ahead ? "var(--w-on-narrative-positive)" : "var(--w-on-narrative-negative)" }}>
                {Math.abs(Math.round(pace.progressPct - pace.expectedPct))}%p {pace.ahead ? "앞서" : "뒤처져"}
              </strong>{" "}
              있어요.
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function LeadCard({
  row,
  now,
  expectedPct,
  series,
}: {
  row: BackcastRow;
  now: number | null;
  expectedPct: number | null;
  series: number[];
}) {
  const progress = leadProgressPct(row, now);
  const behind = progress != null && expectedPct != null && progress < expectedPct;
  const tone = progress == null ? "muted" : behind ? "warn" : "ok";

  const accent =
    tone === "warn" ? "var(--w-status-cautionary)" : tone === "ok" ? "var(--w-status-positive)" : "var(--w-fg-alternative)";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-[18px] rounded-2xl",
        tone === "warn"
          ? "shadow-[inset_0_0_0_1.5px_var(--w-status-cautionary-line)] bg-[var(--w-status-cautionary-soft)]"
          : "shadow-[inset_0_0_0_1px_var(--w-line-neutral)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[14px] text-[var(--w-fg-strong)]">
          {row.label} <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">{backcastShortLabel(row.kind)}</span>
        </span>
        {tone !== "muted" && (
          <Chip variant={behind ? "warn" : "success"} size="sm">
            {behind ? "뒤처짐" : "순항"}
          </Chip>
        )}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-bold text-[26px] leading-none tracking-[-0.028em] text-[var(--w-fg-strong)] [font-variant-numeric:tabular-nums]">
          {fmtBackcastValue(row.kind, now)}
        </span>
        <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">
          {row.target == null ? "목표 미정" : `목표 ${fmtBackcastValue(row.kind, row.target)}`}
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-[var(--w-bg-neutral)]">
        <span
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={{ width: `${progress ?? 0}%`, background: accent }}
        />
      </div>

      <MiniBars data={series} color={accent} mutedColor="var(--w-fg-assistive)" height={34} highlight="last" />
    </div>
  );
}
