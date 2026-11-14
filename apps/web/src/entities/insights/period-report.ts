// 성과 리포트의 "성과" 부분 (기능 6, 정책서 16.1). AI 없이 실제 숫자와 정해진 계산(정책서 8.2)만 쓴다.
// 주간은 지난 월~일, 월간은 지난 달력 한 달이고, 바로 앞 같은 길이 기간과 비교한다.

import type { AccountDailyPoint } from "./account-trend";

export type ReportKind = "weekly" | "monthly";
export type Range = { start: string; end: string }; // YYYY-MM-DD, 양 끝 포함

export type ReportMetric = {
  key: string;
  label: string;
  value: number | null; // 계산할 수 없으면 null (예: 구매 0회의 객단가)
  previous: number | null;
  unit: "won" | "pct" | "count" | "ratio";
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(s + "T00:00:00Z");
const addDays = (s: string, n: number) => {
  const d = day(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** today(YYYY-MM-DD) 기준 리포트 기간과 비교 기간. */
export function reportRanges(kind: ReportKind, today: string): { current: Range; previous: Range } {
  if (kind === "weekly") {
    const dow = (day(today).getUTCDay() + 6) % 7; // 월=0
    const thisMonday = addDays(today, -dow);
    const start = addDays(thisMonday, -7);
    return {
      current: { start, end: addDays(start, 6) },
      previous: { start: addDays(start, -7), end: addDays(start, -1) },
    };
  }
  const t = day(today);
  const firstThis = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const firstLast = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
  const firstPrev = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 2, 1));
  return {
    current: { start: iso(firstLast), end: addDays(iso(firstThis), -1) },
    previous: { start: iso(firstPrev), end: addDays(iso(firstLast), -1) },
  };
}

type Totals = { spend: number; impressions: number; clicks: number; lpv: number; revenue: number; purchases: number };

function totals(daily: AccountDailyPoint[], r: Range): Totals {
  const t: Totals = { spend: 0, impressions: 0, clicks: 0, lpv: 0, revenue: 0, purchases: 0 };
  for (const p of daily) {
    if (p.date < r.start || p.date > r.end) continue;
    t.spend += p.spend;
    t.impressions += p.impressions;
    t.clicks += p.clicks;
    t.lpv += p.landingPageView;
    t.revenue += p.purchaseValue;
    t.purchases += p.purchaseCount;
  }
  return t;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

function metrics(t: Totals, marginRate?: number | null): Omit<ReportMetric, "previous">[] {
  const list: Omit<ReportMetric, "previous">[] = [
    { key: "spend", label: "쓴 광고비", value: t.spend, unit: "won" },
    { key: "ctr", label: "클릭률", value: div(t.clicks * 100, t.impressions), unit: "pct" },
    { key: "cpc", label: "클릭당 비용", value: div(t.spend, t.clicks), unit: "won" },
    { key: "purchases", label: "구매 수", value: t.purchases, unit: "count" },
    { key: "revenue", label: "매출", value: t.revenue, unit: "won" },
    { key: "roas", label: "ROAS", value: div(t.revenue, t.spend), unit: "ratio" },
    { key: "cpa", label: "구매당 비용", value: div(t.spend, t.purchases), unit: "won" },
    { key: "aov", label: "객단가", value: div(t.revenue, t.purchases), unit: "won" },
    { key: "cvr", label: "구매 전환율", value: div(t.purchases * 100, t.lpv), unit: "pct" },
  ];
  if (marginRate != null && marginRate > 0) {
    list.push({ key: "contribution", label: "공헌이익", value: t.revenue * marginRate - t.spend, unit: "won" });
    list.push({ key: "bepRoas", label: "손익분기 ROAS", value: 1 / marginRate, unit: "ratio" });
  }
  return list;
}

export function buildPeriodReport(
  daily: AccountDailyPoint[],
  ranges: { current: Range; previous: Range },
  marginRate?: number | null,
): ReportMetric[] {
  const prev = new Map(metrics(totals(daily, ranges.previous), marginRate).map((m) => [m.key, m.value]));
  return metrics(totals(daily, ranges.current), marginRate).map((m) => ({ ...m, previous: prev.get(m.key) ?? null }));
}

export function formatMetric(m: Pick<ReportMetric, "unit">, v: number | null): string {
  if (v == null) return "—";
  if (m.unit === "won") return `${Math.round(v).toLocaleString("ko-KR")}원`;
  if (m.unit === "pct") return `${v.toFixed(2)}%`;
  if (m.unit === "ratio") return v.toFixed(2);
  return Math.round(v).toLocaleString("ko-KR");
}

/** 지난 기간 대비 변화(%). 비교할 수 없으면 null. */
export function deltaPct(m: ReportMetric): number | null {
  if (m.value == null || m.previous == null || m.previous === 0) return null;
  return ((m.value - m.previous) / Math.abs(m.previous)) * 100;
}

export function toReportCsv(metricsList: ReportMetric[], range: Range): string {
  const rows = [["지표", "값", "지난 기간", "기간", "출처"]];
  for (const m of metricsList) {
    rows.push([m.label, m.value == null ? "" : String(m.value), m.previous == null ? "" : String(m.previous), `${range.start}~${range.end}`, "Meta"]);
  }
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}
