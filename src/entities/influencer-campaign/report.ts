// PRD-influencer-marketing.md §4.5 — 캠페인 리포트 텍스트/CSV 조립. entities/insights/report.ts 패턴과 동형.
// 전부 결정적 조립(LLM 미사용). insight(headline/insights)는 Claude 산출물을 그대로 인용만 한다.

import type { AggregatedPerformance } from "@entities/creator/aggregate";
import type { Creator } from "@entities/creator/model";
import type { CampaignEntry, InfluencerCampaign } from "./model";

export type PerCreatorRow = {
  handle: string;
  stage: CampaignEntry["stage"];
  reach?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  cost?: number;
};

export type InfluencerReportInsight = {
  headline: string;
  insights: string[];
};

export type InfluencerCampaignReport = {
  campaignName: string;
  aggregated: AggregatedPerformance;
  perCreator: PerCreatorRow[];
  insight: InfluencerReportInsight | null;
};

// entries × creator 매칭으로 핸들 표기 행을 만든다. creator 삭제된 entry 는 "(삭제된 크리에이터)"로 표시.
export function buildPerCreatorRows(campaign: InfluencerCampaign, creators: Creator[]): PerCreatorRow[] {
  return campaign.entries
    .filter((e) => e.performance != null)
    .map((e) => {
      const creator = creators.find((c) => c.id === e.creatorId);
      return {
        handle: creator?.handle ?? "(삭제된 크리에이터)",
        stage: e.stage,
        reach: e.performance?.reach,
        clicks: e.performance?.clicks,
        conversions: e.performance?.conversions,
        revenue: e.performance?.revenue,
        cost: e.performance?.cost,
      };
    });
}

export function buildInfluencerCampaignReport(
  campaign: InfluencerCampaign,
  aggregated: AggregatedPerformance,
  perCreator: PerCreatorRow[],
  insight: InfluencerReportInsight | null,
): InfluencerCampaignReport {
  return { campaignName: campaign.name, aggregated, perCreator, insight };
}

export function serializeInfluencerReportText(report: InfluencerCampaignReport): string {
  const lines: string[] = [];
  lines.push(`인플루언서 캠페인 리포트 — ${report.campaignName}`);
  lines.push("");
  lines.push("[집계]");
  lines.push(`도달 ${report.aggregated.reach.toLocaleString("ko-KR")}`);
  lines.push(`클릭 ${report.aggregated.clicks.toLocaleString("ko-KR")}`);
  lines.push(`전환 ${report.aggregated.conversions.toLocaleString("ko-KR")}`);
  if (report.aggregated.revenue != null) lines.push(`매출 ₩${report.aggregated.revenue.toLocaleString("ko-KR")}`);
  if (report.aggregated.cost != null) lines.push(`협업비 ₩${report.aggregated.cost.toLocaleString("ko-KR")}`);
  if (report.aggregated.roas != null) lines.push(`ROAS ${report.aggregated.roas.toFixed(2)}x`);

  if (report.perCreator.length > 0) {
    lines.push("");
    lines.push("[크리에이터별]");
    for (const row of report.perCreator) {
      const parts: string[] = [];
      if (row.reach != null) parts.push(`도달 ${row.reach.toLocaleString("ko-KR")}`);
      if (row.clicks != null) parts.push(`클릭 ${row.clicks.toLocaleString("ko-KR")}`);
      if (row.conversions != null) parts.push(`전환 ${row.conversions.toLocaleString("ko-KR")}`);
      if (row.revenue != null) parts.push(`매출 ₩${row.revenue.toLocaleString("ko-KR")}`);
      lines.push(`- ${row.handle}: ${parts.join(" · ") || "데이터 없음"}`);
    }
  }

  if (report.insight) {
    lines.push("");
    lines.push("[AI 요약]");
    lines.push(report.insight.headline);
    for (const line of report.insight.insights) lines.push(`- ${line}`);
  }

  return lines.join("\n");
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADERS = ["핸들", "단계", "도달", "클릭", "전환", "매출", "협업비"];

export function toInfluencerCampaignCsv(perCreator: PerCreatorRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of perCreator) {
    lines.push(
      [
        csvCell(row.handle),
        csvCell(row.stage),
        csvCell(row.reach),
        csvCell(row.clicks),
        csvCell(row.conversions),
        csvCell(row.revenue),
        csvCell(row.cost),
      ].join(","),
    );
  }
  return "﻿" + lines.join("\n");
}
