// 역산 지도 — 후행 목표 하나에서 선행지표 4개(클릭률·구매 전환율·객단가·클릭당 비용)의 목표치를 역산한다.
// 목표 세우기 화면은 "지금 얼마 → 얼마까지"를 네 줄로 보여주기 위해 같은 항등식을 지표별 배분으로 푼다.
//
//   ROAS = 객단가 × 전환율 / 클릭당비용,   클릭당비용 = CPM / (10 × 클릭률%)
//   → ROAS = 객단가 × 전환율 × 10 × 클릭률% / CPM
//
// 필요한 개선폭 k 를 세 지렛대(클릭률·전환율·객단가)에 로그 공간에서 나눠 곱이 정확히 k 가 되게 한다.
// 클릭당비용은 CPM 이 그대로일 때 클릭률 목표에서 따라 나온다(별도 지렛대가 아니라 결과).

import type { AccountDailyPoint } from "./account-trend";
import type { GoalMetric, LagTarget } from "./goal";
import { bepRoas } from "./profit";

export type BackcastKind = "ctr" | "cvr" | "aov" | "cpc";

export type BackcastRow = {
  kind: BackcastKind;
  label: string;
  /** 실측. null = 아직 측정이 없어 목표치를 낼 수 없는 줄. */
  current: number | null;
  target: number | null;
  /** "+0.4%p" · "-11%" 처럼 이미 사람이 읽는 형태. null 이면 표시하지 않는다. */
  deltaLabel: string | null;
  /** 값이 커지는 게 좋은 지표인지 — 색을 정하는 데 쓴다. */
  betterUp: boolean;
};

export type BackcastInputs = {
  /** 클릭률 % (2.10 = 2.10%) */
  ctr?: number;
  /** 구매 전환율 fraction (0.0525 = 5.25%) */
  cvr?: number;
  /** 객단가 원 */
  aov?: number;
  /** 클릭당 비용 원 */
  cpc?: number;
  /** 1000회 노출당 비용 원 */
  cpm?: number;
};

export type BackcastMap = {
  /** 후행 목표 실측(ROAS 배수 또는 CPA 원). null = 전환 측정이 아직 없음. */
  lagCurrent: number | null;
  /** 후행 목표값. 공헌이익 흑자는 마진율로 계산한 손익분기 ROAS. */
  lagTarget: number | null;
  metric: GoalMetric;
  /** 지금 대비 몇 % 좋아져야 하는지. null = 실측이 없어 계산 불가. */
  liftPct: number | null;
  rows: BackcastRow[];
};

// ponytail: 지렛대별 기여 가중치는 고정값. 계정별 탄력성 추정은 실측 표본이 쌓인 뒤에.
// 합이 1 이라 세 지표 목표치의 곱이 정확히 k 가 된다.
const ROAS_WEIGHTS: Record<"ctr" | "cvr" | "aov", number> = { ctr: 0.35, cvr: 0.4, aov: 0.25 };
// CPA 는 객단가와 무관(CPA = 클릭당비용 / 전환율) — 두 지렛대에만 배분한다.
const CPA_WEIGHTS: Record<"ctr" | "cvr" | "aov", number> = { ctr: 0.45, cvr: 0.55, aov: 0 };

const LABEL: Record<BackcastKind, string> = {
  ctr: "클릭률",
  cvr: "구매 전환율",
  aov: "객단가",
  cpc: "클릭당 비용",
};

/** 후행 목표 실측값 — ROAS·공헌이익은 ROAS 로, CPA 는 CPA 로 읽는다. */
export function lagCurrentOf(metric: GoalMetric, current: { roas?: number | null; cpa?: number | null }): number | null {
  return metric === "cpa" ? current.cpa ?? null : current.roas ?? null;
}

/** 후행 목표값 — 공헌이익 흑자는 목표값을 입력받지 않고 손익분기 ROAS 가 곧 목표. */
export function lagTargetOf(lag: LagTarget, marginRate: number | null): number | null {
  if (lag.metric === "contribution") return bepRoas(marginRate);
  // 0 이하는 "아직 안 정함" — 0.0x 같은 가짜 목표를 그리지 않는다.
  return lag.target > 0 ? lag.target : null;
}

/** 필요한 개선 배수. 1.43 = 43% 더 좋아져야 함. 값이 작을수록 좋은 CPA 는 방향을 뒤집는다. */
export function liftFactor(metric: GoalMetric, currentValue: number | null, target: number | null): number | null {
  if (currentValue == null || target == null || currentValue <= 0 || target <= 0) return null;
  const k = metric === "cpa" ? currentValue / target : target / currentValue;
  return k > 0 ? k : null;
}

function pctPointLabel(from: number, to: number): string {
  const diff = to - from;
  return `${diff >= 0 ? "+" : "-"}${Math.abs(diff).toFixed(1)}%p`;
}

function pctLabel(from: number, to: number): string {
  if (from === 0) return "—";
  const diff = ((to - from) / from) * 100;
  return `${diff >= 0 ? "+" : "-"}${Math.abs(diff).toFixed(0)}%`;
}

function row(kind: BackcastKind, current: number | null, target: number | null, betterUp: boolean): BackcastRow {
  const measured = current != null && target != null;
  return {
    kind,
    label: LABEL[kind],
    current,
    target,
    deltaLabel: !measured
      ? null
      : kind === "ctr" || kind === "cvr"
        ? pctPointLabel(kind === "cvr" ? current * 100 : current, kind === "cvr" ? target * 100 : target)
        : pctLabel(current, target),
    betterUp,
  };
}

export function deriveBackcastMap(
  lag: LagTarget,
  current: { roas?: number | null; cpa?: number | null },
  inputs: BackcastInputs,
  marginRate: number | null,
): BackcastMap {
  const lagCurrent = lagCurrentOf(lag.metric, current);
  const lagTarget = lagTargetOf(lag, marginRate);
  const k = liftFactor(lag.metric, lagCurrent, lagTarget);
  const weights = lag.metric === "cpa" ? CPA_WEIGHTS : ROAS_WEIGHTS;

  const lift = (value: number | undefined, weight: number): number | null => {
    if (value == null || !Number.isFinite(value) || value <= 0) return null;
    if (k == null) return null;
    return value * Math.pow(k, weight);
  };

  const ctrTarget = lift(inputs.ctr, weights.ctr);
  const cvrTarget = lift(inputs.cvr, weights.cvr);
  const aovTarget = lift(inputs.aov, weights.aov);

  // 클릭당 비용은 지렛대가 아니라 결과 — CPM 이 그대로면 클릭률이 오른 만큼 싸진다.
  // CPM 실측이 없으면 클릭률 개선폭을 그대로 되돌려 쓴다(같은 항등식의 근사).
  const cpcTarget =
    ctrTarget == null
      ? null
      : inputs.cpm != null && inputs.cpm > 0
        ? inputs.cpm / (10 * ctrTarget)
        : inputs.cpc != null && inputs.cpc > 0 && inputs.ctr != null && inputs.ctr > 0
          ? inputs.cpc * (inputs.ctr / ctrTarget)
          : null;

  return {
    lagCurrent,
    lagTarget,
    metric: lag.metric,
    liftPct: k != null ? (k - 1) * 100 : null,
    rows: [
      row("ctr", inputs.ctr ?? null, ctrTarget, true),
      row("cvr", inputs.cvr ?? null, cvrTarget, true),
      row("aov", inputs.aov ?? null, aovTarget, true),
      row("cpc", inputs.cpc ?? null, cpcTarget, false),
    ],
  };
}

// ── 목표 난이도 · 달성 경로 ────────────────────────────────────────────────────
// 마지막 확인 화면과 추적 화면이 같은 판정을 쓰도록 여기 한 곳에서만 계산한다.

export type GoalDifficulty = "안정적" | "도전적" | "공격적";

// ponytail: 주당 개선폭 7% 는 시연용 고정 가정. 실측 개선 속도가 쌓이면 계정별 회귀로 대체.
const WEEKLY_LIFT_PCT = 7;

export type GoalOutlook = {
  difficulty: GoalDifficulty;
  /** 목표까지 걸릴 것으로 보는 주 수. null = 실측이 없어 계산 불가. */
  weeks: number | null;
  /** 예상 달성일 ISO(yyyy-mm-dd). null = 계산 불가. */
  etaDate: string | null;
  liftPct: number | null;
};

export function deriveGoalOutlook(liftPct: number | null, from: Date): GoalOutlook {
  if (liftPct == null) return { difficulty: "안정적", weeks: null, etaDate: null, liftPct: null };
  const difficulty: GoalDifficulty = liftPct <= 20 ? "안정적" : liftPct <= 55 ? "도전적" : "공격적";
  const weeks = Math.max(1, Math.ceil(liftPct / WEEKLY_LIFT_PCT));
  const eta = new Date(from.getTime() + weeks * 7 * 86400000);
  return { difficulty, weeks, etaDate: eta.toISOString().slice(0, 10), liftPct };
}

// 목표값 추천 3구간 — 실측 대비 배수. 후행 목표가 CPA 면 낮을수록 좋으므로 나눈다.
const RECOMMEND_STEPS: { multiplier: number; difficulty: GoalDifficulty }[] = [
  { multiplier: 1.2, difficulty: "안정적" },
  { multiplier: 1.45, difficulty: "도전적" },
  { multiplier: 1.7, difficulty: "공격적" },
];

export type TargetSuggestion = { value: number; difficulty: GoalDifficulty; weeks: number };

export function suggestTargets(metric: GoalMetric, currentValue: number | null): TargetSuggestion[] {
  if (currentValue == null || currentValue <= 0) return [];
  return RECOMMEND_STEPS.map(({ multiplier, difficulty }) => {
    const value = metric === "cpa" ? currentValue / multiplier : currentValue * multiplier;
    const rounded = metric === "cpa" ? Math.round(value / 100) * 100 : Math.round(value * 10) / 10;
    return { value: rounded, difficulty, weeks: Math.max(1, Math.ceil(((multiplier - 1) * 100) / WEEKLY_LIFT_PCT)) };
  });
}

// ── 선행지표 일별 시계열 ───────────────────────────────────────────────────────
// 추적 화면의 미니 막대용. daily 는 링크클릭을 따로 주지 않아 전환율 분모는 clicks 로 근사한다
// (계정 합산 CVR 과 절대값이 조금 다르다 — 흐름을 읽는 용도).

export function deriveLeadSeries(daily: AccountDailyPoint[], days = 7): Record<BackcastKind, number[]> {
  const rows = [...daily].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  return {
    ctr: rows.map((d) => (d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0)),
    cvr: rows.map((d) => (d.clicks > 0 ? d.purchaseCount / d.clicks : 0)),
    aov: rows.map((d) => (d.purchaseCount > 0 ? d.purchaseValue / d.purchaseCount : 0)),
    cpc: rows.map((d) => (d.clicks > 0 ? d.spend / d.clicks : 0)),
  };
}

/** 기준선 → 목표 구간에서 지금 어디까지 왔는지(0~100). 비용 지표는 방향을 뒤집는다. */
export function leadProgressPct(row: BackcastRow, now: number | null): number | null {
  if (row.current == null || row.target == null || now == null) return null;
  const span = row.target - row.current;
  if (span === 0) return null;
  return Math.max(0, Math.min(100, ((now - row.current) / span) * 100));
}

// ── 진척 ─────────────────────────────────────────────────────────────────────
// 시작값(목표를 세운 시점의 실측)에서 목표값까지 몇 % 왔는지. 예상 경로는 경과일 비율로 본다.

export type GoalPace = {
  /** 시작 → 목표 구간에서 지금 위치(0~100). null = 시작값·실측이 없음. */
  progressPct: number | null;
  /** 오늘까지 와 있어야 하는 위치(0~100). */
  expectedPct: number | null;
  /** 남은 일수. periodDays 를 넘기면 0. */
  daysLeft: number | null;
  ahead: boolean | null;
};

export function deriveGoalPace(input: {
  metric: GoalMetric;
  baseline: number | null;
  currentValue: number | null;
  target: number | null;
  createdAt: string;
  periodDays: number;
  now: Date;
}): GoalPace {
  const { metric, baseline, currentValue, target, createdAt, periodDays, now } = input;
  const started = Date.parse(createdAt);
  const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((now.getTime() - started) / 86400000)) : null;
  const daysLeft = elapsed == null ? null : Math.max(0, periodDays - elapsed);
  const expectedPct = elapsed == null ? null : Math.min(100, (elapsed / Math.max(1, periodDays)) * 100);

  if (baseline == null || currentValue == null || target == null || baseline === target) {
    return { progressPct: null, expectedPct, daysLeft, ahead: null };
  }
  const span = metric === "cpa" ? baseline - target : target - baseline;
  const moved = metric === "cpa" ? baseline - currentValue : currentValue - baseline;
  if (span === 0) return { progressPct: null, expectedPct, daysLeft, ahead: null };
  const progressPct = Math.max(0, Math.min(100, (moved / span) * 100));
  return {
    progressPct,
    expectedPct,
    daysLeft,
    ahead: expectedPct == null ? null : progressPct >= expectedPct,
  };
}
