// PRD-influencer-marketing.md §6 — 캠페인 성과 리포트 인사이트 (Claude). Server-side only.
// ADR-031/065 §4 — 수치는 입력(집계) 실측 그대로만 인용, 새 수치 생성 금지. 해석·제안만.

import { generateClaudeText } from "@/lib/claude-client";
import type { AggregatedPerformance } from "@entities/creator/aggregate";

export interface ReportInsightCampaign {
  name: string;
  goal: string;
}

export interface ReportInsightPerCreator {
  handle: string;
  reach?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
}

export interface GenerateReportInsightParams {
  campaign: ReportInsightCampaign;
  aggregated: AggregatedPerformance;
  perCreator: ReportInsightPerCreator[];
}

export interface GenerateReportInsightResult {
  headline: string;
  insights: string[];
}

const SYSTEM = `너는 인플루언서 캠페인 성과를 해석해주는 마케팅 코치야.

규칙:
- 아래 [데이터]에 주어진 숫자만 인용해. 새로운 수치·비율·추정치를 절대 지어내지 마.
- 데이터에 없는 값(예: revenue 미입력)에 대해서는 "매출 데이터가 없어 판단하기 어려워요" 처럼 정직하게 말하고, 추정하지 마.
- 크리에이터 간 상대 비교(누가 더 잘했는지)는 주어진 수치 범위 안에서만 해.
- 해석과 다음 액션 제안 중심으로 써. 진단만 하지 말고 무엇을 하면 좋을지 한 마디씩 곁들여.
- 한국어. 간결하고 친근하게. 과장 금지.
- insights 는 3~6개.

출력은 아래 JSON 객체 하나. 코드펜스·설명 없이 JSON 만:
{
  "headline": "캠페인 성과 한 줄 요약",
  "insights": ["...", "..."]
}`;

function num(n: number): string {
  return n.toLocaleString("ko-KR");
}

function buildPrompt(p: GenerateReportInsightParams): string {
  const lines: string[] = ["[데이터]\n"];
  lines.push(`## 캠페인`);
  lines.push(`- 이름: ${p.campaign.name}`);
  lines.push(`- 목표: ${p.campaign.goal}`);
  lines.push("");

  lines.push(`## 전체 집계`);
  lines.push(`- 도달 ${num(p.aggregated.reach)} · 클릭 ${num(p.aggregated.clicks)} · 전환 ${num(p.aggregated.conversions)}`);
  if (p.aggregated.revenue != null) lines.push(`- 매출 ₩${num(p.aggregated.revenue)}`);
  if (p.aggregated.cost != null) lines.push(`- 협업비 ₩${num(p.aggregated.cost)}`);
  if (p.aggregated.roas != null) lines.push(`- ROAS ${p.aggregated.roas.toFixed(2)}`);
  lines.push("");

  lines.push(`## 크리에이터별 성과`);
  if (p.perCreator.length === 0) {
    lines.push("- 크리에이터별 성과 데이터가 없어요.");
  } else {
    for (const c of p.perCreator) {
      const parts: string[] = [];
      if (c.reach != null) parts.push(`도달 ${num(c.reach)}`);
      if (c.clicks != null) parts.push(`클릭 ${num(c.clicks)}`);
      if (c.conversions != null) parts.push(`전환 ${num(c.conversions)}`);
      if (c.revenue != null) parts.push(`매출 ₩${num(c.revenue)}`);
      lines.push(`- ${c.handle}: ${parts.join(" · ") || "데이터 없음"}`);
    }
  }

  return lines.join("\n");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
}

export function parseReportInsight(text: string): GenerateReportInsightResult {
  let parsed: { headline?: unknown; insights?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
  }
  const headline = str(parsed.headline);
  const insights = strArray(parsed.insights);
  if (!headline || !insights.length) {
    throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
  }
  return { headline, insights };
}

export const creatorReportInsight = {
  async generate(params: GenerateReportInsightParams): Promise<GenerateReportInsightResult> {
    const text = await generateClaudeText(buildPrompt(params), {
      systemInstruction: SYSTEM,
      json: true,
    });
    return parseReportInsight(text);
  },
};
