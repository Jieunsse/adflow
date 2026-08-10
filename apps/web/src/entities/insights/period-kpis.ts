// 정량 계기판(KPI 스트립·캠페인 테이블) 파생 순수함수. 데이터 소스(실/데모)와 무관.
// 정직성 원칙 — Meta Insights 가 실제로 주는 필드와 그 산술 파생값만. reach/frequency 는 회수 안 함 → 미사용.

import type { AccountDailyPoint } from "./account-trend";
import { landingRateOf } from "./funnel-breakdown";
import type { CampaignSummary } from "@/lib/meta-ads";

// ── 기간 분할 ────────────────────────────────────────────────────────────────
// 날짜 정렬 후 뒤 periodDays 개를 current, 그 앞 periodDays 개를 previous 로 나눈다.
// previous 가 periodDays 를 못 채우면(데이터 부족) 빈 배열 — 델타 생략 신호로 소비된다.
export function splitWindow(
  daily: AccountDailyPoint[],
  periodDays: number,
): { current: AccountDailyPoint[]; previous: AccountDailyPoint[] } {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.slice(-periodDays);
  const rest = sorted.slice(0, Math.max(0, sorted.length - periodDays));
  const previous = rest.length >= periodDays ? rest.slice(-periodDays) : [];
  return { current, previous };
}

// ── KPI 지표 값 + 델타 ────────────────────────────────────────────────────────
export type KpiDeltaTone = "positive" | "negative" | "neutral";

export type KpiValue = {
  value: number;
  deltaPct?: number; // 생략 = 델타 미표시(이전 기간 분모 0 또는 데이터 부족)
};

export type PeriodKpis = {
  spend: KpiValue;
  impressions: KpiValue;
  clicks: KpiValue;
  ctr: KpiValue; // % — ΣClicks/ΣImpressions (일별 ctr 평균 아님)
  cpc: KpiValue;
  cpm: KpiValue;
};

const sum = (rows: AccountDailyPoint[], key: keyof AccountDailyPoint): number =>
  rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);

function pctDelta(curr: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return ((curr - prev) / prev) * 100;
}

function deriveKpi(curr: number, prev: number | null): KpiValue {
  return prev == null ? { value: curr } : { value: curr, deltaPct: pctDelta(curr, prev) };
}

// previous.length === 0 → 이전 기간 데이터 없음(기간 미달) → 델타 생략.
export function derivePeriodKpis(current: AccountDailyPoint[], previous: AccountDailyPoint[]): PeriodKpis {
  const hasPrev = previous.length > 0;

  const cSpend = sum(current, "spend");
  const cImpr = sum(current, "impressions");
  const cClicks = sum(current, "clicks");
  const cCtr = cImpr > 0 ? (cClicks / cImpr) * 100 : 0;
  const cCpc = cClicks > 0 ? cSpend / cClicks : 0;
  const cCpm = cImpr > 0 ? (cSpend / cImpr) * 1000 : 0;

  const pSpend = hasPrev ? sum(previous, "spend") : null;
  const pImpr = hasPrev ? sum(previous, "impressions") : null;
  const pClicks = hasPrev ? sum(previous, "clicks") : null;
  const pCtr = hasPrev && pImpr != null && pImpr > 0 ? (pClicks! / pImpr) * 100 : null;
  const pCpc = hasPrev && pClicks != null && pClicks > 0 ? pSpend! / pClicks : null;
  const pCpm = hasPrev && pImpr != null && pImpr > 0 ? (pSpend! / pImpr) * 1000 : null;

  return {
    spend: deriveKpi(cSpend, pSpend),
    impressions: deriveKpi(cImpr, pImpr),
    clicks: deriveKpi(cClicks, pClicks),
    ctr: deriveKpi(cCtr, pCtr),
    cpc: deriveKpi(cCpc, pCpc),
    cpm: deriveKpi(cCpm, pCpm),
  };
}

// 증가 방향의 좋고나쁨. 지출·노출은 중립(항상 neutral) — 호출부가 별도 처리.
const INCREASE_IS_GOOD: Record<"ctr" | "clicks" | "conversions" | "revenue" | "roas" | "cpc" | "cpm" | "cpa", boolean> = {
  ctr: true,
  clicks: true,
  conversions: true,
  revenue: true,
  roas: true,
  cpc: false,
  cpm: false,
  cpa: false,
};

export function deltaTone(metric: keyof typeof INCREASE_IS_GOOD, deltaPct: number): KpiDeltaTone {
  if (deltaPct === 0) return "neutral";
  const increased = deltaPct > 0;
  const good = INCREASE_IS_GOOD[metric];
  return increased === good ? "positive" : "negative";
}

// ── 전환 게이트(캠페인 합산 — 기존 conversionCampaigns 로직과 동일 기준 재사용) ───────────────
export type ConversionSummary = {
  count: number;
  conversionCount: number; // purchaseCount 합
  conversionValue: number; // purchaseValue 합
  conversionSpend: number; // 전환 캠페인 지출 합
  roas: number;
  cpa: number;
};

export function deriveConversionSummary(campaigns: CampaignSummary[]): ConversionSummary | null {
  const conv = campaigns.filter((c) => c.objective === "OUTCOME_SALES" && c.purchaseValue != null);
  if (conv.length === 0) return null;
  const conversionSpend = conv.reduce((s, c) => s + c.spend, 0);
  const conversionValue = conv.reduce((s, c) => s + (c.purchaseValue ?? 0), 0);
  const conversionCount = conv.reduce((s, c) => s + (c.purchaseCount ?? 0), 0);
  return {
    count: conv.length,
    conversionCount,
    conversionValue,
    conversionSpend,
    roas: conversionSpend > 0 ? conversionValue / conversionSpend : 0,
    cpa: conversionCount > 0 ? conversionSpend / conversionCount : 0,
  };
}

// 매출 델타 — daily.purchaseValue 실측. ROAS 델타는 daily 가 계정 전체 지출만 가지고
// 있어(전환 캠페인 전용 지출의 일별 시계열 없음) 매출/전체지출 비율로 근사한다 — 표시는
// 방향성 참고용이며 현재값(정확한 conversionSpend 기준)과는 분모가 다르다는 한계가 있다.
export function deriveRevenueRoasDelta(
  current: AccountDailyPoint[],
  previous: AccountDailyPoint[],
): { revenue: KpiValue; roasApprox?: number } {
  const cRevenue = sum(current, "purchaseValue");
  const cSpend = sum(current, "spend");
  if (previous.length === 0) return { revenue: { value: cRevenue } };
  const pRevenue = sum(previous, "purchaseValue");
  const pSpend = sum(previous, "spend");
  const revenue = deriveKpi(cRevenue, pRevenue);
  const cRoas = cSpend > 0 ? cRevenue / cSpend : 0;
  const pRoas = pSpend > 0 ? pRevenue / pSpend : null;
  return { revenue, roasApprox: pRoas != null ? pctDelta(cRoas, pRoas) : undefined };
}

// ── 캠페인 성과 테이블 파생값 ───────────────────────────────────────────────────
export type CampaignTableRow = {
  id: string;
  headline: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  isConversion: boolean;
  purchaseCount: number | null;
  roas: number | null;
  // ADR-063 — 도착률(랜딩률). 분모 = linkClick(clicks 아님). linkClick 미측정 → null(측정 안 됨, 0 아님).
  landingRate: number | null;
};

export function toCampaignTableRow(c: CampaignSummary): CampaignTableRow {
  const isConversion = c.objective === "OUTCOME_SALES" && c.purchaseValue != null;
  return {
    id: c.id,
    headline: c.headline,
    status: c.status,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.ctr,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    isConversion,
    purchaseCount: isConversion ? (c.purchaseCount ?? 0) : null,
    roas: isConversion && c.spend > 0 ? (c.purchaseValue ?? 0) / c.spend : null,
    landingRate: landingRateOf(c),
  };
}

export type CampaignTableSortKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "purchaseCount" | "roas" | "landingRate";
export type SortDir = "asc" | "desc";

export function sortCampaignRows(
  rows: CampaignTableRow[],
  key: CampaignTableSortKey,
  dir: SortDir,
): CampaignTableRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? -Infinity;
    const bv = b[key] ?? -Infinity;
    return (av - bv) * factor;
  });
}
