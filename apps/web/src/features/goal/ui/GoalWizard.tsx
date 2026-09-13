"use client";

// 목표 세우기 — 한 화면 한 질문. 답할 때마다 위쪽 문장이 채워지고 오른쪽 역산 지도가 같이 그려진다.
// 스텝 4개(이름·후행 목표·목표값·추적 기간) + 마지막 확인 + 저장 완료.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Goal, GoalMetric } from "@entities/insights/goal";
import { bepRoas } from "@entities/insights/profit";
import { clearGoalDraft, loadGoalDraft, saveGoalDraft } from "@features/goal/model/goal-draft";
import {
  deriveBackcastMap,
  deriveGoalOutlook,
  lagCurrentOf,
  liftFactor,
  suggestTargets,
  type BackcastInputs,
  type GoalDifficulty,
} from "@entities/insights/backcast";
import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import Icon, { type IconName } from "@shared/ui/Icon";
import { fmt, fmtKRW, kDate } from "@shared/lib/format";
import { cn } from "@shared/lib/cn";
import { BackcastPanel, fmtLagValue, lagMetricLabel, lagUnit } from "./BackcastPanel";

const STEP_TITLES = ["목표 이름", "후행 목표", "목표값", "추적 기간"] as const;
const NEXT_LABELS = ["다음 · 후행 목표", "다음 · 목표값", "다음 · 추적 기간", "다음 · 마지막 확인"] as const;
const CONFIRM_STEP = STEP_TITLES.length; // 4 = 마지막 확인

const PERIOD_OPTIONS = [
  { days: 30, title: "한 사이클 안에 결판내기", desc: "소재·입찰 조정 효과를 빠르게 확인해요.", recommended: true },
  { days: 60, title: "구조를 바꿔볼 여유 두기", desc: "상세페이지·가격까지 손볼 계획이면 좋아요.", recommended: false },
  { days: 90, title: "분기 단위로 보기", desc: "재구매처럼 천천히 움직이는 지표에 맞아요.", recommended: false },
];

const METRIC_GROUPS: { label: string; metrics: { metric: GoalMetric; name: string; hint: string }[] }[] = [
  {
    label: "효율",
    metrics: [
      { metric: "roas", name: "ROAS", hint: "광고비 대비 매출" },
      { metric: "cpa", name: "CPA", hint: "구매 1건당 비용" },
    ],
  },
  {
    label: "수익성",
    metrics: [{ metric: "contribution", name: "공헌이익 흑자", hint: "원가·수수료 뺀 이익" }],
  },
];

const DIFFICULTY_COLOR: Record<GoalDifficulty, string> = {
  안정적: "var(--w-status-positive)",
  도전적: "var(--w-status-cautionary)",
  공격적: "var(--w-status-negative)",
};

const BENEFITS: { icon: IconName; title: string; desc: string; bg: string; fg: string }[] = [
  {
    icon: "bell",
    title: "이탈하면 바로 알려드려요",
    desc: "선행지표가 예상 경로에서 벗어나면 알림이 가요.",
    bg: "var(--w-primary-soft)",
    fg: "var(--w-primary-press)",
  },
  {
    icon: "trend-up",
    title: "제안이 목표에 맞춰져요",
    desc: "소재·예산 제안이 이 목표 기준으로 다시 정렬돼요.",
    bg: "var(--w-status-positive-soft)",
    fg: "var(--w-status-positive)",
  },
  {
    icon: "check-circle",
    title: "주간 리포트가 생겨요",
    desc: "매주 월요일에 선행지표 4개 진척을 정리해드려요.",
    bg: "var(--w-accent-violet-soft)",
    fg: "var(--w-accent-violet)",
  },
];

export type GoalWizardProps = {
  goal: Goal | null;
  step: number;
  inputs: BackcastInputs;
  current: { roas?: number | null; cpa?: number | null };
  marginRate: number | null;
  /** 이름 스텝의 "가져오기" 칩 — 진행 중인 캠페인 이름. */
  campaignNames: string[];
  onSave: (goal: Goal) => void;
  onStepChange: (step: number) => void;
  onClose: () => void;
  onOpenTracker: (goalId: string) => void;
};

export function GoalWizard({
  goal,
  step,
  inputs,
  current,
  marginRate,
  campaignNames,
  onSave,
  onStepChange,
  onClose,
  onOpenTracker,
}: GoalWizardProps) {
  const goalId = goal?.id ?? null;
  const initialName = goal?.name ?? "";
  const initialMetric = goal?.lag.metric ?? "roas";
  const initialTargetDraft = goal && initialMetric !== "contribution" ? String(goal.lag.target) : "";
  const initialPeriodDays = goal?.periodDays ?? 30;
  const [name, setName] = useState(initialName);
  const [metric, setMetric] = useState<GoalMetric>(initialMetric);
  const [targetDraft, setTargetDraft] = useState(initialTargetDraft);
  const [periodDays, setPeriodDays] = useState(initialPeriodDays);
  const [savedGoal, setSavedGoal] = useState<Goal | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = loadGoalDraft(goalId);
    setName(draft?.name ?? initialName);
    setMetric(draft?.metric ?? initialMetric);
    setTargetDraft(draft?.targetDraft ?? initialTargetDraft);
    setPeriodDays(draft?.periodDays ?? initialPeriodDays);
    setHydrated(true);
  }, [goalId, initialMetric, initialName, initialPeriodDays, initialTargetDraft]);

  useEffect(() => {
    if (!hydrated || savedGoal) return;
    saveGoalDraft({ goalId, name, metric, targetDraft, periodDays });
  }, [goalId, hydrated, metric, name, periodDays, savedGoal, targetDraft]);

  const bep = bepRoas(marginRate);
  const isContribution = metric === "contribution";
  const target = isContribution ? bep : Number(targetDraft);
  const targetValid = isContribution ? bep != null : targetDraft.trim() !== "" && Number.isFinite(target) && (target ?? 0) > 0;
  const lagCurrent = lagCurrentOf(metric, current);

  const map = useMemo(
    () => deriveBackcastMap({ metric, target: targetValid && target != null ? target : 0 }, current, inputs, marginRate),
    [metric, target, targetValid, current, inputs, marginRate],
  );
  const outlook = useMemo(() => {
    const k = liftFactor(metric, lagCurrent, targetValid ? target : null);
    return deriveGoalOutlook(k == null ? null : (k - 1) * 100, new Date());
  }, [metric, lagCurrent, target, targetValid]);

  const suggestions = useMemo(() => suggestTargets(metric, lagCurrent), [metric, lagCurrent]);

  const canAdvance =
    step === 0 ? name.trim() !== "" : step === 1 ? true : step === 2 ? targetValid : true;

  const goNext = () => {
    if (!canAdvance) return;
    onStepChange(Math.min(CONFIRM_STEP, step + 1));
  };
  const goPrev = () => onStepChange(Math.max(0, step - 1));

  // Enter 로 다음 스텝. 한글 조합 중 Enter 는 조합 확정이라 넘기면 안 된다(isComposing).
  useEffect(() => {
    if (step >= CONFIRM_STEP || savedGoal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      if (canAdvance) onStepChange(Math.min(CONFIRM_STEP, step + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canAdvance, savedGoal, onStepChange]);

  const save = () => {
    if (name.trim() === "" || !targetValid || target == null) return;
    const next: Goal = {
      id: goal?.id ?? crypto.randomUUID(),
      name: name.trim(),
      lag: { metric, target },
      periodDays,
      // 기준선은 처음 세울 때만 찍는다 — 수정할 때마다 다시 찍으면 그동안의 진척이 사라진다.
      baseline: goal?.baseline ?? lagCurrent ?? undefined,
      baselineInputs: goal?.baselineInputs ?? inputs,
      createdAt: goal?.createdAt ?? new Date().toISOString(),
    };
    onSave(next);
    clearGoalDraft();
    setSavedGoal(next);
  };

  if (savedGoal) {
    return (
      <Shell>
        <SavedScreen
          goal={savedGoal}
          outlook={outlook}
          leadCount={map.rows.filter((r) => r.target != null).length}
          onOpenTracker={() => { clearGoalDraft(); onOpenTracker(savedGoal.id); }}
          onClose={onClose}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <WizardHeader step={step} onClose={onClose} />
      {/* 이름은 질문과 다음 순서를 한 화면에 보여준다. 이후 단계만 문장을 채운다. */}
      {step > 0 && step < CONFIRM_STEP && (
        <SentenceStrip
          step={step}
          name={name}
          metricLabel={lagMetricLabel(metric)}
          targetLabel={targetValid && target != null ? `${fmtLagValue(metric, target)}${lagUnit(metric)}` : null}
          periodLabel={`${periodDays}일`}
        />
      )}

      {step === CONFIRM_STEP ? (
        <ConfirmScreen
          name={name}
          metric={metric}
          target={target}
          periodDays={periodDays}
          lagCurrent={lagCurrent}
          outlook={outlook}
          leadCount={map.rows.filter((r) => r.target != null).length}
          onBack={goPrev}
          onSave={save}
        />
      ) : (
        <div
          className={cn(
            "grid grid-cols-1",
            step === 0
              ? "mx-auto min-h-[520px] w-full max-w-[1320px] gap-10 py-14 lg:flex-1 lg:content-center lg:grid-cols-[minmax(0,1.35fr)_minmax(400px,0.85fr)] lg:gap-14 lg:py-16"
              : "mt-12 min-h-[560px] border-t border-[var(--w-line-alternative)] lg:mt-16 lg:h-[min(720px,calc(100vh-220px))] lg:grid-cols-[minmax(0,0.92fr)_minmax(440px,1.08fr)] lg:overflow-hidden",
          )}
        >
          <div
            className={cn(
              "flex min-h-[440px] flex-col",
              step === 0 ? "" : "p-7 sm:p-9 lg:border-r lg:border-[var(--w-line-alternative)] lg:overflow-y-auto",
            )}
          >
            <div
              className={cn(
                "mx-auto flex w-full flex-col gap-6",
                step === 0 ? "max-w-[720px]" : "relative h-full max-w-[560px]",
              )}
            >
              <div className={cn("flex flex-1 flex-col", step === 0 ? "" : "justify-center lg:-translate-y-6")}>
                {step === 0 && <NameStep name={name} onChange={setName} campaignNames={campaignNames} />}
                {step === 1 && (
                  <MetricStep
                    metric={metric}
                    onChange={setMetric}
                    current={current}
                    marginRate={marginRate}
                    bep={bep}
                    leadCount={map.rows.filter((r) => r.current != null).length}
                  />
                )}
                {step === 2 && (
                  <TargetStep
                    metric={metric}
                    draft={targetDraft}
                    onChange={setTargetDraft}
                    lagCurrent={lagCurrent}
                    suggestions={suggestions}
                    bep={bep}
                    marginRate={marginRate}
                  />
                )}
                {step === 3 && <PeriodStep periodDays={periodDays} onChange={setPeriodDays} />}
              </div>

              <div className={cn("flex flex-wrap items-center gap-3 pt-2", step === 0 ? "mt-3" : "mt-auto lg:absolute lg:bottom-0 lg:left-0")}>
                {step > 0 && (
                  <Button variant="ghost" size="lg" type="button" onClick={goPrev}>
                    이전
                  </Button>
                )}
                <Button variant="primary" size="lg" type="button" disabled={!canAdvance} onClick={goNext}>
                  {step === 0 ? "후행 목표 고르기" : NEXT_LABELS[step]}
                </Button>
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
                  {step === 0 ? "이름을 입력하면 다음으로 갈 수 있어요" : "Enter로도 넘어가요"}
                </span>
              </div>
            </div>
          </div>

          <div className={cn(step === 0 ? "self-start" : "min-h-[420px] lg:min-h-0 lg:overflow-y-auto")}>
            {step === 0 ? (
              <GoalSetupPath name={name} />
            ) : (
              <BackcastPanel
                map={map}
                statusLabel={backcastStatus(step, map.rows.filter((r) => r.current != null).length)}
                statusTone={step === 3 && map.liftPct != null ? "accent" : "muted"}
                note={BACKCAST_NOTE[step]}
                footer={step === 3 && map.liftPct != null ? <PathFooter periodDays={periodDays} metric={metric} lagCurrent={lagCurrent} target={target} outlookDate={outlook.etaDate} /> : undefined}
              />
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

const BACKCAST_NOTE = [
  "후행 목표 하나만 정하면, 거기까지 가는 선행지표는 저희가 역산해서 채워드려요.",
  "다음 스텝에서 목표값을 정하면, 이 지표들의 목표치가 한 번에 계산돼요.",
  "노출수·도달수는 지도에 올리지 않아요. 움직여도 매출로 이어지지 않는 허영지표라서요.",
  "",
];

function backcastStatus(step: number, branchCount: number): string {
  if (step === 0) return "아직 비어 있어요";
  if (step === 1) return branchCount > 0 ? `가지 ${branchCount}개가 붙었어요` : "실측을 기다리는 중이에요";
  if (step === 3) return "완성";
  return "숫자를 바꾸면 실시간 갱신";
}

// ── 셸 ──────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="flex min-h-[calc(100vh-48px)] w-full flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-8"
      data-screen-label="목표 세우기"
    >
      {children}
    </section>
  );
}

function WizardHeader({ step, onClose }: { step: number; onClose: () => void }) {
  const isConfirm = step === CONFIRM_STEP;
  const pct = isConfirm ? 100 : ((step + 1) / STEP_TITLES.length) * 100;
  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-[var(--w-line-alternative)] px-1 pb-5 sm:px-2">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="!h-8 !w-8 !shrink-0 !px-0"
        aria-label="목표 만들기 닫기"
        onClick={onClose}
      >
        <Icon name="x" size={16} />
      </Button>
      <div className="flex flex-1 flex-col gap-1">
        <span className="w-overline">성과 목표</span>
        <span className="w-h4">새 목표 세우기</span>
      </div>
      {isConfirm ? (
        <span className="w-caption font-bold text-[var(--w-primary-press)]">마지막 확인</span>
      ) : (
        <span className="w-caption font-bold tracking-[0.04em] text-[var(--w-fg-neutral)] [font-variant-numeric:tabular-nums]">
          {step + 1}
          <span className="text-[var(--w-fg-alternative)]"> / {STEP_TITLES.length}</span>
        </span>
      )}
      <div
        className="h-1 w-20 overflow-hidden rounded-full bg-[var(--w-bg-neutral)] sm:w-32"
        role="progressbar"
        aria-label="목표 만들기 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-[var(--w-primary-normal)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// 답할수록 채워지는 한 문장. 지금 스텝의 칸이 강조되고, 아직 안 채운 칸은 점선으로 남는다.
function SentenceStrip({
  step,
  name,
  metricLabel,
  targetLabel,
  periodLabel,
}: {
  step: number;
  name: string;
  metricLabel: string;
  targetLabel: string | null;
  periodLabel: string;
}) {
  const slots: { text: string | null; placeholder: string; suffix: string }[] = [
    { text: name.trim() || null, placeholder: "목표 이름", suffix: "의" },
    { text: step >= 1 ? metricLabel : null, placeholder: "지표", suffix: "를" },
    { text: step >= 2 ? targetLabel : null, placeholder: "목표값", suffix: "까지," },
    { text: step >= 3 ? periodLabel : null, placeholder: "기간", suffix: "동안" },
  ];

  return (
    <div className="flex shrink-0 justify-center border-b border-[var(--w-line-alternative)] px-1 py-5 sm:px-2">
      <div
        className="w-display-1 flex max-w-[1320px] flex-wrap items-center justify-center gap-x-4 gap-y-3 text-center"
        style={{ color: "var(--w-fg-alternative)" }}
      >
        {slots.map((slot, i) => (
          <span key={slot.placeholder} className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap">
            {slot.text == null ? (
              <span className="rounded-lg border-[1.5px] border-dashed border-[var(--w-line-normal)] px-3 py-1 text-[48px] font-semibold text-[var(--w-fg-alternative)]">
                {slot.placeholder}
              </span>
            ) : i === Math.min(step, 3) ? (
              <span
                className="truncate rounded-lg bg-[var(--w-primary-normal)] px-3 py-1 text-[48px] font-extrabold text-white"
                style={{ boxShadow: "0 0 0 4px var(--w-focus-ring)" }}
              >
                {slot.text}
              </span>
            ) : (
              <span className="truncate rounded-lg bg-[var(--w-bg-neutral)] px-3 py-1 text-[48px] font-bold text-[var(--w-fg-strong)]">
                {slot.text}
              </span>
            )}
            <span className="w-display-2 shrink-0 text-[var(--w-fg-alternative)]">{slot.suffix}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionHead({ title, desc }: { title: React.ReactNode; desc: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="m-0 font-bold text-[26px] sm:text-[32px] leading-[1.26] tracking-[-0.024em] text-[var(--w-fg-strong)] break-keep">
        {title}
      </h2>
      <p className="m-0 font-medium text-[15px] leading-[1.65] text-[var(--w-fg-neutral)] break-keep text-pretty">{desc}</p>
    </div>
  );
}

// ── 스텝 1 · 목표 이름 ────────────────────────────────────────────────────────

function NameStep({
  name,
  onChange,
  campaignNames,
}: {
  name: string;
  onChange: (v: string) => void;
  campaignNames: string[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="w-display-editorial m-0 break-keep">이번 목표를<br />어떤 이름으로 남길까요?</h2>
        <p className="w-body m-0 break-keep text-pretty">
          리포트와 알림에서 이 이름으로 목표를 찾아요.<br />캠페인 이름을 그대로 가져와도 괜찮아요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="goal-name" className="w-label">목표 이름</label>
          <span className="w-caption shrink-0 [font-variant-numeric:tabular-nums]">{name.length} / 30</span>
        </div>
        <div className="flex h-[72px] items-center gap-4 rounded-xl border-2 border-[var(--w-primary-normal)] bg-[var(--w-bg-normal)] px-5 focus-within:border-[var(--w-primary-press)] focus-within:ring-4 focus-within:ring-[var(--w-focus-ring)]">
          <input
            ref={ref}
            id="goal-name"
            type="text"
            value={name}
            maxLength={30}
            placeholder="예: 7월 신제품 런칭"
            onChange={(e) => onChange(e.target.value)}
            className="h-full min-w-0 flex-1 border-none bg-transparent text-[26px] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--w-fg-strong)] outline-none focus-visible:!outline-none placeholder:text-[var(--w-fg-alternative)] sm:text-[34px]"
          />
        </div>
      </div>

      {campaignNames.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="w-caption">진행 중인 캠페인 이름을 가져올 수 있어요</span>
          <div className="flex flex-wrap gap-2">
            {campaignNames.slice(0, 4).map((cn) => (
              <button
                key={cn}
                type="button"
                onClick={() => onChange(cn.slice(0, 30))}
                className="h-9 max-w-full truncate rounded-full border border-[var(--w-line-normal)] px-3 font-semibold text-[13px] text-[var(--w-fg-normal)] hover:border-[var(--w-primary-normal)] hover:text-[var(--w-primary-press)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--w-focus-ring)]"
              >
                {cn}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GoalSetupPath({ name }: { name: string }) {
  const steps = [
    { label: "목표 이름", value: name.trim() || "아직 이름을 입력하지 않았어요" },
    { label: "후행 목표", value: "ROAS, CPA, 공헌이익 중 하나를 골라요" },
    { label: "목표값", value: "현재 실적을 보고 현실적인 값을 정해요" },
    { label: "추적 기간", value: "언제까지 볼지 정하면 준비가 끝나요" },
  ];

  return (
    <aside className="w-full rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-7">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--w-line-alternative)] pb-5">
        <div>
          <h3 className="w-h4 m-0">목표를 만드는 순서</h3>
          <p className="w-caption m-0 mt-1">지금은 이름만 정하면 돼요.</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--w-primary-soft)] text-[13px] font-extrabold text-[var(--w-primary-press)]">
          01
        </span>
      </div>

      <ol className="m-0 mt-6 list-none p-0">
        {steps.map((item, index) => {
          const active = index === 0;
          return (
            <li key={item.label} className="relative grid min-h-[68px] grid-cols-[28px_minmax(0,1fr)] gap-4">
              {index < steps.length - 1 && (
                <span className="absolute left-[13px] top-7 h-[42px] w-px bg-[var(--w-line-normal)]" />
              )}
              <span
                className={cn(
                  "z-10 grid h-7 w-7 place-items-center rounded-full border text-[12px] font-bold",
                  active
                    ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-normal)] text-white"
                    : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-neutral)]",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-[1.4] text-[var(--w-fg-strong)]">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block break-keep text-[13px] font-medium leading-[1.5] text-pretty",
                    active ? "text-[var(--w-primary-press)]" : "text-[var(--w-fg-neutral)]",
                  )}
                >
                  {item.value}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 rounded-xl bg-[var(--w-primary-soft)] p-5">
        <span className="block text-[14px] font-bold text-[var(--w-primary-press)]">마지막에 받는 것</span>
        <span className="mt-2 block break-keep text-[13px] font-medium leading-[1.55] text-[var(--w-fg-normal)] text-pretty">
          정한 후행 목표를 달성하는 데 필요한 선행지표와 추적 기준을 알려드려요.
        </span>
      </div>
    </aside>
  );
}

// ── 스텝 2 · 후행 목표 지표 ───────────────────────────────────────────────────

function MetricStep({
  metric,
  onChange,
  current,
  marginRate,
  bep,
  leadCount,
}: {
  metric: GoalMetric;
  onChange: (m: GoalMetric) => void;
  current: { roas?: number | null; cpa?: number | null };
  marginRate: number | null;
  bep: number | null;
  leadCount: number;
}) {
  const measuredOf = (m: GoalMetric): string => {
    if (m === "cpa") return current.cpa != null ? `현재 ${fmtKRW(Math.round(current.cpa))}` : "실측 대기";
    if (m === "contribution") {
      return marginRate == null ? "마진율 필요" : bep != null ? `손익분기 ${bep.toFixed(1)}x` : "실측 대기";
    }
    return current.roas != null ? `현재 ${current.roas.toFixed(1)}x` : "실측 대기";
  };

  return (
    <>
      <QuestionHead
        title="무엇으로 성패를 판단할까요?"
        desc="결과를 말해주는 후행 목표 하나만 고르면 돼요."
      />

      <div className="flex flex-col gap-3.5">
        {METRIC_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <span className="font-bold text-[12px] tracking-[0.01em] text-[var(--w-fg-neutral)]">{group.label}</span>
            {group.metrics.map((opt) => {
              const selected = metric === opt.metric;
              const disabled = opt.metric === "contribution" && marginRate == null;
              return (
                <button
                  key={opt.metric}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(opt.metric)}
                  className={cn(
                    "flex items-center gap-3.5 p-4 rounded-xl text-left transition-[box-shadow,background] duration-[120ms]",
                    selected
                      ? "bg-[var(--w-primary-soft)] shadow-[inset_0_0_0_1.5px_var(--w-primary-normal)]"
                      : "shadow-[inset_0_0_0_1px_var(--w-line-neutral)] hover:bg-[var(--w-bg-neutral)]",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn(
                      "w-[22px] h-[22px] shrink-0 rounded-full grid place-items-center",
                      selected
                        ? "bg-[var(--w-primary-normal)] text-white"
                        : "shadow-[inset_0_0_0_1.5px_var(--w-line-normal)]",
                    )}
                  >
                    {selected && <Icon name="check" size={14} strokeWidth={2.5} />}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-bold text-[16px] leading-tight text-[var(--w-fg-strong)]">{opt.name}</span>
                    <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">{opt.hint}</span>
                    <span
                      className={cn(
                        "mt-1 font-medium text-[12px] leading-[1.4]",
                        selected ? "text-[var(--w-primary-press)]" : "text-[var(--w-fg-neutral)]",
                      )}
                    >
                      {disabled
                        ? "브랜드 프로필에 마진율을 넣으면 고를 수 있어요"
                        : leadCount > 0
                          ? `선행지표 ${leadCount}개가 붙어요`
                          : "선행지표는 실측이 쌓이면 붙어요"}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-[13px] text-[var(--w-fg-normal)] [font-variant-numeric:tabular-nums]">
                    {measuredOf(opt.metric)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// ── 스텝 3 · 목표값 ──────────────────────────────────────────────────────────

function TargetStep({
  metric,
  draft,
  onChange,
  lagCurrent,
  suggestions,
  bep,
  marginRate,
}: {
  metric: GoalMetric;
  draft: string;
  onChange: (v: string) => void;
  lagCurrent: number | null;
  suggestions: { value: number; difficulty: GoalDifficulty; weeks: number }[];
  bep: number | null;
  marginRate: number | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  if (metric === "contribution") {
    return (
      <>
        <QuestionHead
          title={<>흑자 기준선은<br />마진율이 정해줘요</>}
          desc="공헌이익 흑자는 목표값을 따로 입력하지 않아요. 마진율로 계산한 손익분기 ROAS가 곧 목표예요."
        />
        <div className="flex items-end gap-2.5 pb-3.5 border-b-2 border-[var(--w-primary-normal)] w-fit">
          <span className="font-bold text-[56px] sm:text-[76px] leading-none tracking-[-0.045em] text-[var(--w-fg-strong)] [font-variant-numeric:tabular-nums]">
            {bep != null ? bep.toFixed(1) : "—"}
          </span>
          <span className="pb-1.5 font-semibold text-[30px] text-[var(--w-fg-neutral)]">x</span>
        </div>
        <p className="m-0 font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] break-keep">
          {marginRate == null
            ? "마진율이 아직 없어요. 브랜드 프로필에서 넣으면 여기가 채워져요."
            : `마진율 ${Math.round(marginRate * 100)}% 기준이에요.`}
        </p>
      </>
    );
  }

  const isCpa = metric === "cpa";
  return (
    <>
      <QuestionHead
        title={isCpa ? <>구매 1건당 비용,<br />얼마까지 낮춰볼까요?</> : <>ROAS를 얼마까지<br />올려볼까요?</>}
        desc={
          lagCurrent != null
            ? `최근 30일 실측은 ${isCpa ? fmtKRW(Math.round(lagCurrent)) : `${lagCurrent.toFixed(1)}x`}예요. 숫자를 바꾸면 옆의 역산 지도가 함께 움직여요.`
            : "전환 측정이 아직 없어서 실측을 못 보여드려요. 목표값을 직접 넣어주세요."
        }
      />

      <div className="flex items-end gap-2.5 pb-3.5 border-b-2 border-[var(--w-primary-normal)] w-fit max-w-full">
        <input
          ref={ref}
          type="text"
          inputMode={isCpa ? "numeric" : "decimal"}
          value={isCpa && draft ? fmt(Number(draft)) : draft}
          placeholder={isCpa ? "15,000" : "3.0"}
          onChange={(e) => onChange(isCpa ? e.target.value.replace(/\D/g, "") : e.target.value)}
          // field-sizing 으로 숫자 폭에 맞춰 줄어든다 — 고정폭이면 단위 'x' 가 저 멀리 떨어진다.
          size={4}
          className="w-auto [field-sizing:content] min-w-[2ch] max-w-full bg-transparent border-none outline-none font-bold text-[56px] sm:text-[76px] leading-none tracking-[-0.045em] text-[var(--w-fg-strong)] [font-variant-numeric:tabular-nums] placeholder:text-[var(--w-fg-alternative)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="shrink-0 pb-1.5 font-semibold text-[30px] text-[var(--w-fg-neutral)]">{isCpa ? "원" : "x"}</span>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-bold text-[12px] tracking-[0.01em] text-[var(--w-fg-neutral)]">추천 구간</span>
          <div className="flex gap-2">
            {suggestions.map((s) => {
              const selected = Number(draft) === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onChange(String(s.value))}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col gap-1 px-3.5 py-3 rounded-xl text-left transition-[box-shadow,background] duration-[120ms]",
                    selected
                      ? "bg-[var(--w-primary-soft)] shadow-[inset_0_0_0_1.5px_var(--w-primary-normal)]"
                      : "shadow-[inset_0_0_0_1px_var(--w-line-neutral)] hover:bg-[var(--w-bg-neutral)]",
                  )}
                >
                  <span
                    className={cn(
                      "font-bold text-[18px] leading-none [font-variant-numeric:tabular-nums]",
                      selected ? "text-[var(--w-primary-press)]" : "text-[var(--w-fg-normal)]",
                    )}
                  >
                    {isCpa ? fmt(s.value) : `${s.value.toFixed(1)}x`}
                  </span>
                  <span
                    className={cn(
                      "font-medium text-[12px] leading-[1.4] truncate",
                      selected ? "text-[var(--w-primary-press)]" : "text-[var(--w-fg-neutral)]",
                    )}
                  >
                    {s.difficulty} · {s.weeks}주
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── 스텝 4 · 추적 기간 ────────────────────────────────────────────────────────

function PeriodStep({ periodDays, onChange }: { periodDays: number; onChange: (d: number) => void }) {
  return (
    <>
      <QuestionHead
        title={<>얼마 동안<br />지켜볼까요?</>}
        desc="기간은 목표를 구분하는 메모예요. 진척 판정은 언제나 최근 30일 실측으로 해요."
      />
      <div className="flex flex-col gap-2">
        {PERIOD_OPTIONS.map((opt) => {
          const selected = periodDays === opt.days;
          return (
            <button
              key={opt.days}
              type="button"
              onClick={() => onChange(opt.days)}
              className={cn(
                "flex items-center gap-4 p-[18px] rounded-2xl text-left transition-[box-shadow,background] duration-[120ms]",
                selected
                  ? "bg-[var(--w-primary-soft)] shadow-[inset_0_0_0_1.5px_var(--w-primary-normal)]"
                  : "shadow-[inset_0_0_0_1px_var(--w-line-neutral)] hover:bg-[var(--w-bg-neutral)]",
              )}
            >
              <span
                className={cn(
                  "w-[76px] shrink-0 font-extrabold text-[26px] leading-none tracking-[-0.03em]",
                  selected ? "text-[var(--w-primary-press)]" : "text-[var(--w-fg-normal)]",
                )}
              >
                {opt.days}일
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="font-bold text-[14px] text-[var(--w-fg-strong)]">{opt.title}</span>
                <span className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)] break-keep">{opt.desc}</span>
              </span>
              {opt.recommended && (
                <Chip variant="accent" size="sm">
                  추천
                </Chip>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// 스텝 4 의 지도 아래 — 목표까지 가는 길을 기간 위에 얹어 보여준다.
function PathFooter({
  periodDays,
  metric,
  lagCurrent,
  target,
  outlookDate,
}: {
  periodDays: number;
  metric: GoalMetric;
  lagCurrent: number | null;
  target: number | null;
  outlookDate: string | null;
}) {
  if (lagCurrent == null || target == null) return null;
  const mid = lagCurrent + (target - lagCurrent) / 2;
  const unit = lagUnit(metric);
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2.5" style={{ background: "var(--w-surface-narrative-raised)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-[13px]" style={{ color: "var(--w-on-narrative)" }}>
          {periodDays}일 달성 경로
        </span>
        <span className="font-medium text-[12px]" style={{ color: "var(--w-on-narrative-alternative)" }}>
          예상 도달 {kDate(outlookDate)}
        </span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: "var(--w-surface-narrative-fill)" }}>
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(90deg, var(--w-on-narrative-primary-soft), var(--w-on-narrative-primary))" }}
        />
      </div>
      <div
        className="flex justify-between font-medium text-[11px] [font-variant-numeric:tabular-nums]"
        style={{ color: "var(--w-on-narrative-alternative)" }}
      >
        <span>오늘 {fmtLagValue(metric, lagCurrent)}{unit}</span>
        <span>{Math.round(periodDays / 2)}일 {fmtLagValue(metric, mid)}{unit}</span>
        <span>{periodDays}일 {fmtLagValue(metric, target)}{unit}</span>
      </div>
    </div>
  );
}

// ── 마지막 확인 ──────────────────────────────────────────────────────────────

function ConfirmScreen({
  name,
  metric,
  target,
  periodDays,
  lagCurrent,
  outlook,
  leadCount,
  onBack,
  onSave,
}: {
  name: string;
  metric: GoalMetric;
  target: number | null;
  periodDays: number;
  lagCurrent: number | null;
  outlook: ReturnType<typeof deriveGoalOutlook>;
  leadCount: number;
  onBack: () => void;
  onSave: () => void;
}) {
  const unit = lagUnit(metric);
  const gapPct = outlook.liftPct;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-[900px] px-6 sm:px-11 py-9 flex flex-col gap-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <Chip variant="accent">목표 1개 · 선행지표 {leadCount}개</Chip>
          {/* break-keep — 한글은 기본값이면 어절 안에서 잘려서 '올려 / 볼게요.' 처럼 끊긴다. */}
          <div className="max-w-[760px] font-bold text-[22px] sm:text-[30px] leading-[1.6] tracking-[-0.012em] text-[var(--w-fg-alternative)] break-keep text-balance">
            <span className="whitespace-nowrap">
              <span className="text-[var(--w-fg-strong)]">{name}</span>의
            </span>{" "}
            <span className="whitespace-nowrap">
              <span className="text-[var(--w-fg-strong)]">{lagMetricLabel(metric)}</span>를
            </span>{" "}
            <span className="whitespace-nowrap">
              <span className="text-[var(--w-primary-normal)]">
                {fmtLagValue(metric, target)}
                {unit}
              </span>
              까지,
            </span>{" "}
            <span className="whitespace-nowrap">
              <span className="text-[var(--w-fg-strong)]">{periodDays}일</span> 동안
            </span>{" "}
            {metric === "cpa" ? "낮춰볼게요." : "올려볼게요."}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="달성 난이도" value={outlook.difficulty} valueColor={DIFFICULTY_COLOR[outlook.difficulty]}>
            <div className="flex gap-1">
              {(["안정적", "도전적", "공격적"] as GoalDifficulty[]).map((d) => (
                <span
                  key={d}
                  className="flex-1 h-1.5 rounded-full"
                  style={{ background: d === outlook.difficulty ? DIFFICULTY_COLOR[d] : "var(--w-bg-neutral)" }}
                />
              ))}
            </div>
            <span className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] break-keep">
              {gapPct == null ? "실측이 쌓이면 난이도를 다시 볼게요." : `지금보다 ${Math.abs(gapPct).toFixed(0)}% 좋아져야 해요.`}
            </span>
          </StatCard>

          <StatCard label="예상 달성 시점" value={outlook.etaDate ? kDate(outlook.etaDate) : "—"}>
            <div className="relative h-1.5 rounded-full bg-[var(--w-bg-neutral)]">
              <span
                className="absolute left-0 top-0 bottom-0 rounded-full bg-[var(--w-primary-normal)]"
                style={{ width: `${outlook.weeks ? Math.min(100, (periodDays / (outlook.weeks * 7)) * 100) : 0}%` }}
              />
            </div>
            <span className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] break-keep">
              {outlook.weeks == null ? "실측이 없어 아직 못 세요." : `지금 속도라면 약 ${outlook.weeks}주 뒤예요.`}
            </span>
          </StatCard>

          <StatCard
            label="메워야 할 갭"
            value={
              lagCurrent == null ? (
                "—"
              ) : (
                <>
                  {fmtLagValue(metric, lagCurrent)}
                  {unit} <span className="text-[var(--w-fg-alternative)]">→</span>{" "}
                  <span className="text-[var(--w-primary-normal)]">
                    {fmtLagValue(metric, target)}
                    {unit}
                  </span>
                </>
              )
            }
          >
            <div className="relative h-1.5 rounded-full bg-[var(--w-bg-neutral)] overflow-hidden">
              <span
                className="absolute left-0 top-0 bottom-0 rounded-full"
                style={{
                  width: "58%",
                  background: "var(--w-fg-alternative)",
                }}
              />
              <span
                className="absolute top-0 bottom-0 right-0"
                style={{
                  left: "58%",
                  background:
                    "repeating-linear-gradient(115deg, var(--w-primary-normal) 0 6px, var(--w-primary-soft) 6px 12px)",
                }}
              />
            </div>
            <span className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] break-keep">
              {gapPct == null ? "전환 측정이 붙으면 채워져요." : `지금보다 ${gapPct >= 0 ? "+" : "-"}${Math.abs(gapPct).toFixed(0)}% 필요해요.`}
            </span>
          </StatCard>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.015em] text-[var(--w-fg-strong)]">
              목표를 세우면 이게 달라져요
            </h3>
            <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">저장하는 순간부터 자동으로 시작돼요</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex gap-3 p-[18px] rounded-2xl shadow-[inset_0_0_0_1px_var(--w-line-neutral)]"
              >
                <span
                  className="w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center"
                  style={{ background: b.bg, color: b.fg }}
                >
                  <Icon name={b.icon} size={18} />
                </span>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-bold text-[14px] text-[var(--w-fg-strong)]">{b.title}</span>
                  <span className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] break-keep">{b.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-[var(--w-line-alternative)]">
          <span className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] break-keep">
            기간은 목표를 구분하는 메모예요 — 진척 판정은 최근 30일 실측으로 해요.
          </span>
          <div className="flex gap-2.5 shrink-0">
            <Button variant="secondary" size="lg" type="button" onClick={onBack}>
              뒤로
            </Button>
            <Button variant="primary" size="lg" type="button" onClick={onSave}>
              목표 세우고 추적 시작
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor,
  children,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 p-5 rounded-2xl bg-[var(--w-bg-alternative)]">
      <span className="font-bold text-[12px] tracking-[0.01em] text-[var(--w-fg-neutral)]">{label}</span>
      <span
        className="font-bold text-[22px] leading-none tracking-[-0.02em] text-[var(--w-fg-strong)]"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
      {children}
    </div>
  );
}

// ── 저장 완료 ────────────────────────────────────────────────────────────────

function SavedScreen({
  goal,
  outlook,
  leadCount,
  onOpenTracker,
  onClose,
}: {
  goal: Goal;
  outlook: ReturnType<typeof deriveGoalOutlook>;
  leadCount: number;
  onOpenTracker: () => void;
  onClose: () => void;
}) {
  const unit = lagUnit(goal.lag.metric);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-7 py-12 text-center">
        <span className="w-[72px] h-[72px] rounded-full grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]">
          <Icon name="check-circle" size={40} />
        </span>
        <div className="flex flex-col gap-2 max-w-[460px]">
          <h2 className="m-0 font-bold text-[24px] leading-[1.3] tracking-[-0.024em] text-[var(--w-fg-strong)]">
            목표를 세웠어요
          </h2>
          <p className="m-0 font-medium text-[15px] leading-[1.65] text-[var(--w-fg-neutral)] break-keep text-pretty">
            오늘부터 선행지표 {leadCount}개를 매일 추적할게요. 경로에서 벗어나면 바로 알려드릴게요.
          </p>
        </div>
        <div className="w-full max-w-[460px] p-[18px] rounded-2xl bg-[var(--w-bg-alternative)] flex flex-col gap-2.5 text-left">
          <span className="font-bold text-[12px] tracking-[0.01em] text-[var(--w-fg-neutral)]">세운 목표</span>
          <span className="font-bold text-[16px] leading-[1.6] text-[var(--w-fg-strong)] break-keep">
            {goal.name}의 {lagMetricLabel(goal.lag.metric)}를 {fmtLagValue(goal.lag.metric, goal.lag.target)}
            {unit}까지, {goal.periodDays ?? 30}일 동안
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <Chip variant={outlook.difficulty === "안정적" ? "success" : outlook.difficulty === "도전적" ? "warn" : "neg"} size="sm">
              {outlook.difficulty}
            </Chip>
            {outlook.etaDate && (
              <Chip variant="neutral" size="sm">
                예상 {kDate(outlook.etaDate)}
              </Chip>
            )}
            <Chip variant="accent" size="sm">
              선행지표 {leadCount}개
            </Chip>
          </div>
        </div>
      </div>
      <div className="shrink-0 px-7 pb-8 flex flex-col items-center gap-2">
        <Button variant="primary" size="lg" type="button" className="w-full max-w-[460px]" onClick={onOpenTracker}>
          추적 화면으로 가기
        </Button>
        <Button variant="ghost" size="lg" type="button" className="w-full max-w-[460px]" onClick={onClose}>
          목록으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
