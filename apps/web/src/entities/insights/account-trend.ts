// ADR-059 — 비즈니스 펄스. 계정 횡단 일별 합산(듀얼추세) + degrade 퍼널 비율.
// 모두 순수함수 — 데이터 소스(실/데모)와 무관. 도메인 어휘는 CONTEXT.md §비즈니스 펄스.

import type { InsightsDailyRow } from "./types";

// ── 계정 일별 합산 (듀얼추세 입력) ───────────────────────────────────────────
// 캠페인별 daily 시리즈를 날짜 키로 합산한다. 다른 캠페인이 다른 날짜 범위를 가져도
// 그날 존재하는 캠페인만 더한다(누락 = 0 기여).
export type AccountDailyPoint = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageView: number; // 미측정 캠페인은 0 기여
  purchaseValue: number; // 비전환 캠페인은 0 기여
};

export function mergeAccountDaily(series: InsightsDailyRow[][]): AccountDailyPoint[] {
  const byDate = new Map<string, AccountDailyPoint>();
  for (const rows of series) {
    for (const r of rows) {
      const p =
        byDate.get(r.date) ??
        { date: r.date, spend: 0, impressions: 0, clicks: 0, landingPageView: 0, purchaseValue: 0 };
      p.spend += r.spend ?? 0;
      p.impressions += r.impressions ?? 0;
      p.clicks += r.clicks ?? 0;
      p.landingPageView += r.landingPageView ?? 0;
      p.purchaseValue += r.purchaseValue ?? 0;
      byDate.set(r.date, p);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── 데모 — totals 를 일별로 분산(둘러보기 추세). 실유저는 getAccountDailyTrend 가 실 daily 회수. ──
// 캠페인별 totals 를 최근 windowDays 창에 결정적 변량으로 흩뿌려 합산한다(데모 "예시" 표식 전제).
export type SummaryLike = {
  id: string;
  impressions: number;
  clicks: number;
  spend: number;
  landingPageView?: number;
  purchaseValue?: number;
};

function seededVariance(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h * 9301 + index * 49297 + 233280) | 0;
  return 0.85 + (((h % 1000) + 1000) % 1000) / 1000 / (1 / 0.3); // [0.85, 1.15)
}

function lastNDates(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ADR-059 amendment §4 — 둘러보기 호조(수렴) 서사. 지출·도착/성과 모두 우상향 드리프트로
// 가중치를 메트릭별로 분리한다(기본 off=균등, 실유저 경로 무관). "예시" 배지 전제(ADR-033).
export function synthAccountDaily(campaigns: SummaryLike[], today: string, windowDays = 14, favorable = false): AccountDailyPoint[] {
  const dates = lastNDates(today, windowDays);
  const points: AccountDailyPoint[] = dates.map((date) => ({
    date,
    spend: 0,
    impressions: 0,
    clicks: 0,
    landingPageView: 0,
    purchaseValue: 0,
  }));
  // 호조: 막대(지출)·라인(도착/매출) 둘 다 증가 램프(성과가 지출보다 더 가파르게) → 효율 개선 서사.
  const n = dates.length;
  const spendDrift = (i: number) => (favorable && n > 1 ? 0.85 + (0.3 * i) / (n - 1) : 1); // 0.85 → 1.15
  const perfDrift = (i: number) => (favorable && n > 1 ? 0.65 + (0.9 * i) / (n - 1) : 1); // 0.65 → 1.55
  for (const c of campaigns) {
    const spendW = dates.map((_, i) => seededVariance(c.id + "w", i) * spendDrift(i));
    const perfW = dates.map((_, i) => seededVariance(c.id + "w", i) * perfDrift(i));
    const spendSum = spendW.reduce((s, w) => s + w, 0) || 1;
    const perfSum = perfW.reduce((s, w) => s + w, 0) || 1;
    dates.forEach((_, i) => {
      const sShare = spendW[i] / spendSum;
      const pShare = perfW[i] / perfSum;
      points[i].spend += c.spend * sShare;
      points[i].impressions += c.impressions * sShare;
      points[i].clicks += c.clicks * pShare;
      points[i].landingPageView += (c.landingPageView ?? 0) * pShare;
      points[i].purchaseValue += (c.purchaseValue ?? 0) * pShare;
    });
  }
  return points.map((p) => ({
    date: p.date,
    spend: Math.round(p.spend),
    impressions: Math.round(p.impressions),
    clicks: Math.round(p.clicks),
    landingPageView: Math.round(p.landingPageView),
    purchaseValue: Math.round(p.purchaseValue),
  }));
}

// ── 듀얼추세 적응형 성과축 ────────────────────────────────────────────────────
// 좌축은 항상 지출. 우(성과)축은 전환 캠페인 ≥1 → 매출, 아니면 도착 ?? 클릭 폴백.
// 축 라벨로 무엇을 읽는지 명시(매출/도착/클릭). hasData=false 면 우측축 EmptyState 티저.
export type PerfMetric = "revenue" | "landing" | "clicks";

export type PerfAxis = {
  metric: PerfMetric;
  label: string; // "매출" | "도착" | "클릭"
  values: number[]; // daily 와 정렬
  hasData: boolean; // 0 이 아닌 값이 하나라도 있나
};

const PERF_LABEL: Record<PerfMetric, string> = {
  revenue: "매출",
  landing: "도착",
  clicks: "클릭",
};

export function pickPerfAxis(daily: AccountDailyPoint[], conversionCampaignCount: number): PerfAxis {
  const build = (metric: PerfMetric, values: number[]): PerfAxis => ({
    metric,
    label: PERF_LABEL[metric],
    values,
    hasData: values.some((v) => v > 0),
  });
  if (conversionCampaignCount > 0) return build("revenue", daily.map((d) => d.purchaseValue));
  const landing = daily.map((d) => d.landingPageView);
  if (landing.some((v) => v > 0)) return build("landing", landing);
  return build("clicks", daily.map((d) => d.clicks));
}

// ── 효율 단일 라인 진단 (지출 대비 성과 흐름) ────────────────────────────────
// 듀얼축 폐기 → 효율(성과/지출) 단일 라인. spend=0 인 날은 null(광고 쉰 날).
export function deriveEfficiency(daily: AccountDailyPoint[], perfAxis: PerfAxis): (number | null)[] {
  return daily.map((d, i) => (d.spend > 0 ? perfAxis.values[i] / d.spend : null));
}

export type TrendVerdict = "diverge" | "co-rise" | "co-fall" | "stable" | "insufficient";

export type TrendMetrics = {
  verdict: TrendVerdict;
  midIndex: number;
  earlyAvg: number; // 효율 앞 절반 평균
  lateAvg: number; // 효율 뒤 절반 평균
  divergeRange?: [number, number]; // 효율이 떨어지는 구간 인덱스(발산일 때만)
};

// 전·후반 효율 평균을 비교해 흐름을 분류한다(절대 수치 인용 없음 → ADR-031 안전).
// 효율 = 성과/지출. 효율이 꺾이면 diverge, 동반 상승/하락은 co-rise/co-fall.
export function deriveTrendMetrics(daily: AccountDailyPoint[], perfAxis: PerfAxis): TrendMetrics {
  const mid = Math.floor(daily.length / 2);
  if (daily.length < 4 || !perfAxis.hasData) {
    return { verdict: "insufficient", midIndex: mid, earlyAvg: 0, lateAvg: 0 };
  }
  const eff = deriveEfficiency(daily, perfAxis);
  const avg = (arr: (number | null)[]) => {
    const vals = arr.filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const earlyAvg = avg(eff.slice(0, mid));
  const lateAvg = avg(eff.slice(mid));

  const spendAvg = (arr: AccountDailyPoint[]) => (arr.length ? arr.reduce((s, d) => s + d.spend, 0) / arr.length : 0);
  const spendEarly = spendAvg(daily.slice(0, mid));
  const spendLate = spendAvg(daily.slice(mid));
  if (spendEarly === 0 || earlyAvg === 0) {
    return { verdict: "insufficient", midIndex: mid, earlyAvg: 0, lateAvg: 0 };
  }
  const spendChange = (spendLate - spendEarly) / spendEarly;
  const effChange = (lateAvg - earlyAvg) / earlyAvg;
  const SIG = 0.1;

  let verdict: TrendVerdict;
  if (spendChange > SIG && effChange < -SIG) verdict = "diverge";
  else if (spendChange > SIG && effChange >= -SIG) verdict = "co-rise";
  else if (spendChange < -SIG) verdict = "co-fall";
  else verdict = "stable";

  // 발산 구간 = mid 이후 효율이 앞 절반 평균 아래로 떨어진 첫 인덱스부터 끝까지.
  let divergeRange: [number, number] | undefined;
  if (verdict === "diverge") {
    let start = mid;
    for (let i = mid; i < eff.length; i++) {
      const v = eff[i];
      if (v != null && v < earlyAvg) { start = i; break; }
    }
    divergeRange = [start, eff.length - 1];
  }
  return { verdict, midIndex: mid, earlyAvg, lateAvg, divergeRange };
}

// 라인 라벨(ROAS 게이트 적용) — 매출축은 "ROAS(광고비 대비 매출)", 그 외는 광고비 1천원당 환산.
export function perfLineLabel(perfAxis: PerfAxis): string {
  switch (perfAxis.metric) {
    case "revenue": return "ROAS(광고비 대비 매출)";
    case "landing": return "광고비 1천원당 도착 수";
    case "clicks": return "광고비 1천원당 클릭 수";
  }
}

// 부제 분기 카피(진단 전용 — 처방 절 없음). 짧은 label(매출/도착/클릭) 사용.
export function trendSubtitle(verdict: TrendVerdict, perfAxis: PerfAxis): string {
  const label = perfAxis.label;
  switch (verdict) {
    case "diverge": return `돈은 더 쓰는데 ${label}은 제자리예요.`;
    case "co-rise": return `쓴 만큼 ${label}도 따라오고 있어요.`;
    case "co-fall": return `지출을 줄이며 ${label}도 함께 줄고 있어요.`;
    case "stable": return `지출과 ${label}이 안정적으로 유지되고 있어요.`;
    case "insufficient": return "흐름을 읽으려면 데이터가 조금 더 필요해요.";
  }
}

// ── degrade 퍼널 (노출→클릭→도착→구매) ───────────────────────────────────────
// 비율막대 = 항상 노출 분모. 단별 전환율(stepRate)의 분모는 직전 단(측정된 부분집합 기준).
// 도착/구매는 측정 게이트 — 측정 캠페인 0 이면 measured=false("측정 켜기" 흐림).
export type FunnelCampaign = {
  impressions: number;
  clicks: number;
  landingPageView?: number; // undefined = 도착 미측정
  purchaseCount?: number; // undefined = 전환 미측정
};

export type FunnelStage = {
  key: "impressions" | "clicks" | "landing" | "purchase";
  label: string;
  value: number;
  measured: boolean; // false → "측정 켜기" 흐림 처리
  pctOfImpressions: number; // 막대 폭 0..1 (분모 고정 = 노출)
  stepRate: number | null; // 직전 단 대비 전환율 0..1 (측정 안 됨 = null)
  denomLabel: string | null; // "도착 측정 N개 기준" (분모 부분집합 명시)
  bigDrop: boolean; // 드롭 큰 단 — 뱃지 + ↘ 강조
};

const BIG_DROP_THRESHOLD = 0.5;

export function deriveFunnel(campaigns: FunnelCampaign[]): { stages: FunnelStage[]; hasData: boolean } {
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);

  const landingMeasured = campaigns.filter((c) => c.landingPageView != null);
  const landingValue = landingMeasured.reduce((s, c) => s + (c.landingPageView ?? 0), 0);
  const landingDenomClicks = landingMeasured.reduce((s, c) => s + c.clicks, 0);

  const convMeasured = campaigns.filter((c) => c.purchaseCount != null);
  const purchaseValue = convMeasured.reduce((s, c) => s + (c.purchaseCount ?? 0), 0);
  // 구매 직전 단 = 도착(측정 시) 아니면 클릭. 전환 측정 캠페인의 직전 단 값을 분모로.
  const convPrevDenom = convMeasured.some((c) => c.landingPageView != null)
    ? convMeasured.reduce((s, c) => s + (c.landingPageView ?? 0), 0)
    : convMeasured.reduce((s, c) => s + c.clicks, 0);
  const convPrevLabel = convMeasured.some((c) => c.landingPageView != null) ? "도착" : "클릭";

  const pct = (v: number) => (impressions > 0 ? Math.min(1, v / impressions) : 0);
  const rate = (num: number, denom: number) => (denom > 0 ? num / denom : null);

  const clickRate = rate(clicks, impressions);
  const landingRate = rate(landingValue, landingDenomClicks);
  const purchaseRate = rate(purchaseValue, convPrevDenom);

  const stages: FunnelStage[] = [
    {
      key: "impressions",
      label: "노출",
      value: impressions,
      measured: true,
      pctOfImpressions: impressions > 0 ? 1 : 0,
      stepRate: null,
      denomLabel: null,
      bigDrop: false,
    },
    {
      key: "clicks",
      label: "클릭",
      value: clicks,
      measured: true,
      pctOfImpressions: pct(clicks),
      stepRate: clickRate,
      denomLabel: "노출 기준",
      bigDrop: clickRate != null && clickRate < BIG_DROP_THRESHOLD,
    },
    {
      key: "landing",
      label: "도착",
      value: landingValue,
      measured: landingMeasured.length > 0,
      pctOfImpressions: pct(landingValue),
      stepRate: landingRate,
      denomLabel: landingMeasured.length > 0 ? `클릭 기준 · 도착 측정 ${landingMeasured.length}개` : null,
      bigDrop: landingRate != null && landingRate < BIG_DROP_THRESHOLD,
    },
    {
      key: "purchase",
      label: "구매",
      value: purchaseValue,
      measured: convMeasured.length > 0,
      pctOfImpressions: pct(purchaseValue),
      stepRate: purchaseRate,
      denomLabel: convMeasured.length > 0 ? `${convPrevLabel} 기준 · 전환 측정 ${convMeasured.length}개` : null,
      bigDrop: purchaseRate != null && purchaseRate < BIG_DROP_THRESHOLD,
    },
  ];

  return { stages, hasData: impressions > 0 };
}
