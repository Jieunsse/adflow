"use client";

// 목표 세우기 — 한 화면 한 질문. 답할 때마다 위쪽 문장이 채워지고 오른쪽 역산 지도가 같이 그려진다.
// 스텝 4개(이름·후행 목표·목표값·추적 기간) + 마지막 확인 + 저장 완료.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Goal, GoalMetric } from "@entities/insights/goal";
import { bepRoas } from "@entities/insights/profit";
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
  inputs: BackcastInputs;
  current: { roas?: number | null; cpa?: number | null };
  marginRate: number | null;
  /** 이름 스텝의 "가져오기" 칩 — 진행 중인 캠페인 이름. */
  campaignNames: string[];
  onSave: (goal: Goal) => void;
  onClose: () => void;
  onOpenTracker: (goalId: string) => void;
};

export function GoalWizard({
  goal,
  inputs,
  current,
  marginRate,
  campaignNames,
  onSave,
  onClose,
  onOpenTracker,
}: GoalWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(goal?.name ?? "");
  const [metric, setMetric] = useState<GoalMetric>(goal?.lag.metric ?? "roas");
  const [targetDraft, setTargetDraft] = useState(() =>
    goal && goal.lag.metric !== "contribution" ? String(goal.lag.target) : "",
  );
  const [periodDays, setPeriodDays] = useState(goal?.periodDays ?? 30);
  const [savedGoal, setSavedGoal] = useState<Goal | null>(null);

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
    setStep((s) => Math.min(CONFIRM_STEP, s + 1));
  };
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  // Enter 로 다음 스텝. 한글 조합 중 Enter 는 조합 확정이라 넘기면 안 된다(isComposing).
  useEffect(() => {
    if (step >= CONFIRM_STEP || savedGoal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      if (canAdvance) setStep((s) => Math.min(CONFIRM_STEP, s + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canAdvance, savedGoal]);

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
    setSavedGoal(next);
  };

  if (savedGoal) {
    return (
      <Shell onClose={onClose}>
        <SavedScreen
          goal={savedGoal}
          outlook={outlook}
          leadCount={map.rows.filter((r) => r.target != null).length}
          onOpenTracker={() => onOpenTracker(savedGoal.id)}
          onClose={onClose}
        />
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose}>
      <WizardHeader step={step} onClose={onClose} onBack={goPrev} />
      {/* 마지막 확인은 아래 큰 문장이 같은 말을 해서 스트립을 내리지 않는다. */}
      {step < CONFIRM_STEP && (
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
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 border-t border-[var(--w-line-alternative)] overflow-y-auto lg:overflow-hidden">
          <div className="flex flex-col gap-6 p-7 sm:p-9 lg:border-r border-[var(--w-line-alternative)] lg:overflow-y-auto">
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

            <div className="mt-auto pt-2 flex items-center gap-3 flex-wrap">
              {step > 0 && (
                <Button variant="ghost" size="lg" type="button" onClick={goPrev}>
                  이전
                </Button>
              )}
              <Button variant="primary" size="lg" type="button" disabled={!canAdvance} onClick={goNext}>
                {NEXT_LABELS[step]}
              </Button>
              <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">Enter로도 넘어가요</span>
            </div>
          </div>

          <div className="min-h-[420px] lg:min-h-0 lg:overflow-y-auto">
            <BackcastPanel
              map={map}
              statusLabel={backcastStatus(step, map.rows.filter((r) => r.current != null).length)}
              statusTone={step === 3 && map.liftPct != null ? "accent" : "muted"}
              empty={step === 0}
              note={BACKCAST_NOTE[step]}
              footer={step === 3 && map.liftPct != null ? <PathFooter periodDays={periodDays} metric={metric} lagCurrent={lagCurrent} target={target} outlookDate={outlook.etaDate} /> : undefined}
            />
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

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 시안은 1160×700 카드 한 장 — 뷰포트로 늘리면 넓은 화면에서 컬럼이 벌어지고 여백이 죽는다.
  // 캔버스 위에 카드를 띄우고, 좁은 화면에서만 전체를 채운다.
  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--w-bg-alternative)] flex items-center justify-center lg:p-7"
      role="dialog"
      aria-modal="true"
      aria-label="목표 세우기"
    >
      <div className="w-full max-w-[1160px] h-full lg:h-[min(760px,100%)] flex flex-col overflow-hidden bg-[var(--w-bg-elevated)] lg:rounded-2xl lg:shadow-[var(--w-shadow-strong)]">
        {children}
      </div>
    </div>
  );
}

function WizardHeader({ step, onClose, onBack }: { step: number; onClose: () => void; onBack: () => void }) {
  const isConfirm = step === CONFIRM_STEP;
  const pct = isConfirm ? 100 : ((step + 1) / STEP_TITLES.length) * 100;
  return (
    <div className="h-14 shrink-0 px-5 sm:px-6 flex items-center gap-4 border-b border-[var(--w-line-alternative)]">
      <button
        type="button"
        onClick={isConfirm ? onBack : onClose}
        className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
      >
        <Icon name={isConfirm ? "arrow-left" : "x"} size={18} />
        {isConfirm ? "기간 다시 고르기" : "나가기"}
      </button>
      <span className="flex-1" />
      {isConfirm ? (
        <span className="font-bold text-[12px] tracking-[0.01em] text-[var(--w-primary-press)]">마지막 확인</span>
      ) : (
        <span className="font-bold text-[12px] tracking-[0.04em] text-[var(--w-fg-neutral)] [font-variant-numeric:tabular-nums]">
          {String(step + 1).padStart(2, "0")}
          <span className="text-[var(--w-fg-alternative)]"> / {String(STEP_TITLES.length).padStart(2, "0")}</span>
        </span>
      )}
      <div className="w-24 sm:w-[180px] h-1 rounded-full bg-[var(--w-bg-neutral)] overflow-hidden">
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
    <div className="shrink-0 py-6 px-5 flex justify-center">
      {/* 행간 1.35 — 칸(px+py)이 line-box 를 이미 키운다. 1.65 면 두 줄로 넘어갈 때 문장이 흩어진다.
          조사는 gap-1.5 로 자기 칸에 붙이고, 칸끼리는 gap-x-3 으로 띄워 어디에 걸린 조사인지 보이게. */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 max-w-[820px] font-semibold text-[17px] sm:text-[26px] leading-[1.35] tracking-[-0.02em] text-[var(--w-fg-alternative)]">
        {slots.map((slot, i) => (
          // 칸과 조사는 한 덩어리 — 사이에서 줄이 갈리면 '동안' 만 다음 줄에 홀로 남는다.
          <span key={slot.placeholder} className="inline-flex items-center gap-1.5 whitespace-nowrap max-w-full">
            {slot.text == null ? (
              <span className="px-3 py-1 rounded-lg border-[1.5px] border-dashed border-[var(--w-line-normal)] font-semibold text-[var(--w-fg-alternative)]">
                {slot.placeholder}
              </span>
            ) : i === Math.min(step, 3) ? (
              <span
                className="px-3 py-1 rounded-lg font-extrabold text-white bg-[var(--w-primary-normal)] truncate"
                style={{ boxShadow: "0 0 0 4px var(--w-focus-ring)" }}
              >
                {slot.text}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg font-bold bg-[var(--w-bg-neutral)] text-[var(--w-fg-strong)] truncate">
                {slot.text}
              </span>
            )}
            <span className="shrink-0">{slot.suffix}</span>
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
      <QuestionHead
        title={<>이번 목표,<br />뭐라고 부를까요?</>}
        desc="나중에 리포트와 알림에 이 이름으로 표시돼요. 캠페인 이름 그대로 써도 좋아요."
      />

      <div className="flex items-end gap-2.5 pb-3.5 border-b-2 border-[var(--w-primary-normal)]">
        <input
          ref={ref}
          type="text"
          value={name}
          maxLength={30}
          placeholder="7월 신제품 런칭"
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent border-none outline-none font-bold text-[26px] sm:text-[34px] leading-[1.2] tracking-[-0.03em] text-[var(--w-fg-strong)] placeholder:text-[var(--w-fg-alternative)]"
        />
        <span className="shrink-0 pb-1.5 font-medium text-[13px] text-[var(--w-fg-alternative)] [font-variant-numeric:tabular-nums]">
          {name.length} / 30
        </span>
      </div>

      {campaignNames.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-bold text-[12px] tracking-[0.01em] text-[var(--w-fg-neutral)]">
            진행 중인 캠페인에서 가져오기
          </span>
          <div className="flex flex-wrap gap-2">
            {campaignNames.slice(0, 4).map((cn) => (
              <button
                key={cn}
                type="button"
                onClick={() => onChange(cn.slice(0, 30))}
                className="h-8 px-3 rounded-full border border-[var(--w-line-normal)] font-semibold text-[13px] text-[var(--w-fg-normal)] hover:bg-[var(--w-bg-neutral)] max-w-full truncate"
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
        title={<>무엇으로 성패를<br />판단할까요?</>}
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
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="font-bold text-[15px] leading-tight text-[var(--w-fg-strong)]">
                      {opt.name}{" "}
                      <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">{opt.hint}</span>
                    </span>
                    <span
                      className={cn(
                        "font-medium text-[12px] leading-[1.4]",
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
          type="number"
          inputMode="decimal"
          step={isCpa ? 100 : 0.1}
          min={0}
          value={draft}
          placeholder={isCpa ? "15000" : "3.0"}
          onChange={(e) => onChange(e.target.value)}
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
