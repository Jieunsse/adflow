// ADR-064 — 최근 7일 리포트 + CSV. 전부 결정적 룰(LLM 미사용), 실측 수치만.
// 기간 정의는 대시보드 7일 토글과 완전 동일 — splitWindow/derivePeriodKpis 산출물을 그대로 조립만 한다.

import type { AccountDailyPoint } from "./account-trend";
import type { PeriodKpis, CampaignTableRow } from "./period-kpis";
import type { AccountVerdict } from "./account-verdict";
import type { CampaignVerdictEntry } from "./account-verdict";
import { contributionMargin, bepRoas } from "./profit";

function fmtRangeDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// current/previous 는 splitWindow 산출물(날짜 정렬됨) 그대로.
function dateRangeLabel(days: AccountDailyPoint[]): string | null {
  if (days.length === 0) return null;
  const start = fmtRangeDate(days[0].date);
  const end = fmtRangeDate(days[days.length - 1].date);
  return start === end ? start : `${start}–${end}`;
}

export type ReportKpiDelta = {
  label: string;
  value: string;
  deltaPct?: number;
};

export type ReportProfit = {
  contribution: number | null;
  bepRoas: number | null;
  marginRatePct: number;
};

export type Recent7Report = {
  currentRangeLabel: string | null;
  previousRangeLabel: string | null;
  kpiDeltas: ReportKpiDelta[];
  verdictHeadline: string;
  topSpendCampaigns: { headline: string; spend: number }[];
  attentionCampaigns: { headline: string; status: string }[];
  profit: ReportProfit | null;
};

export type BuildRecent7ReportInput = {
  current: AccountDailyPoint[];
  previous: AccountDailyPoint[];
  kpis: PeriodKpis;
  verdict: AccountVerdict;
  campaignRows: CampaignTableRow[];
  campaignVerdicts: CampaignVerdictEntry[];
  conversionValue?: number;
  conversionSpend?: number;
  marginRate?: number | null;
};

const TOP_SPEND_COUNT = 3;

export function buildRecent7Report(input: BuildRecent7ReportInput): Recent7Report {
  const { current, previous, kpis, verdict, campaignRows, campaignVerdicts, conversionValue, conversionSpend, marginRate } = input;

  const kpiDeltas: ReportKpiDelta[] = [
    { label: "지출", value: `₩${Math.round(kpis.spend.value).toLocaleString("ko-KR")}`, deltaPct: kpis.spend.deltaPct },
    { label: "노출", value: kpis.impressions.value.toLocaleString("ko-KR"), deltaPct: kpis.impressions.deltaPct },
    { label: "클릭", value: kpis.clicks.value.toLocaleString("ko-KR"), deltaPct: kpis.clicks.deltaPct },
    { label: "CTR", value: `${kpis.ctr.value.toFixed(2)}%`, deltaPct: kpis.ctr.deltaPct },
    { label: "CPC", value: `₩${Math.round(kpis.cpc.value).toLocaleString("ko-KR")}`, deltaPct: kpis.cpc.deltaPct },
    { label: "CPM", value: `₩${Math.round(kpis.cpm.value).toLocaleString("ko-KR")}`, deltaPct: kpis.cpm.deltaPct },
  ];

  // 지출 상위 3 — 중립 지표 단일 랭킹(ADR-057 함정 회피). objective 무관.
  const topSpendCampaigns = [...campaignRows]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, TOP_SPEND_COUNT)
    .map((r) => ({ headline: r.headline, spend: r.spend }));

  // 손볼 캠페인 — 캠페인 평결(poor/trap) 재사용. "성과 하위 랭킹" 신설 금지(ADR-057).
  const attentionCampaigns = campaignVerdicts
    .filter((v) => v.status === "poor" || v.status === "trap")
    .map((v) => ({ headline: v.campaign.headline, status: v.status }));

  const profit: ReportProfit | null =
    marginRate != null && conversionValue != null && conversionSpend != null
      ? {
          contribution: contributionMargin(conversionValue, conversionSpend, marginRate),
          bepRoas: bepRoas(marginRate),
          marginRatePct: Math.round(marginRate * 100),
        }
      : null;

  return {
    currentRangeLabel: dateRangeLabel(current),
    previousRangeLabel: dateRangeLabel(previous),
    kpiDeltas,
    verdictHeadline: verdict.headline,
    topSpendCampaigns,
    attentionCampaigns,
    profit,
  };
}

// 클립보드 공유용 플레인 텍스트. 실측 수치만, 측정 안 된 값(델타 없음)은 그 줄 생략.
export function serializeReportText(report: Recent7Report): string {
  const lines: string[] = [];
  const rangeLine =
    report.currentRangeLabel && report.previousRangeLabel
      ? `최근 7일 리포트 (${report.currentRangeLabel} vs ${report.previousRangeLabel})`
      : "최근 7일 리포트";
  lines.push(rangeLine);
  lines.push("");
  lines.push(`평결: ${report.verdictHeadline}`);
  lines.push("");
  lines.push("[KPI]");
  for (const kpi of report.kpiDeltas) {
    const delta = kpi.deltaPct != null ? ` (${kpi.deltaPct >= 0 ? "+" : ""}${kpi.deltaPct.toFixed(1)}%)` : "";
    lines.push(`${kpi.label}: ${kpi.value}${delta}`);
  }

  if (report.topSpendCampaigns.length > 0) {
    lines.push("");
    lines.push("[지출 상위]");
    report.topSpendCampaigns.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.headline} — ₩${c.spend.toLocaleString("ko-KR")}`);
    });
  }

  if (report.attentionCampaigns.length > 0) {
    lines.push("");
    lines.push(`[손볼 캠페인 ${report.attentionCampaigns.length}건]`);
    report.attentionCampaigns.forEach((c) => {
      lines.push(`- ${c.headline}`);
    });
  }

  if (report.profit) {
    lines.push("");
    lines.push("[손익]");
    lines.push(`공헌이익: ₩${(report.profit.contribution ?? 0).toLocaleString("ko-KR")} (마진율 ${report.profit.marginRatePct}% 가정)`);
    if (report.profit.bepRoas != null) lines.push(`손익분기 ROAS: ${report.profit.bepRoas.toFixed(2)}x`);
  }

  return lines.join("\n");
}

// CSV — 클라이언트 사이드 다운로드용. BOM 포함(Excel 한글), null/undefined = 빈 셀(0 아님).
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADERS = ["캠페인명", "상태", "지출", "노출", "클릭", "CTR", "CPC", "전환", "ROAS", "도착률"];

export function toCampaignsCsv(rows: CampaignTableRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.headline),
        csvCell(r.status),
        csvCell(r.spend),
        csvCell(r.impressions),
        csvCell(r.clicks),
        csvCell(Number(r.ctr.toFixed(2))),
        csvCell(Math.round(r.cpc)),
        csvCell(r.purchaseCount),
        csvCell(r.roas != null ? Number(r.roas.toFixed(2)) : null),
        csvCell(r.landingRate != null ? Number((r.landingRate * 100).toFixed(1)) : null),
      ].join(","),
    );
  }
  return "﻿" + lines.join("\n");
}
