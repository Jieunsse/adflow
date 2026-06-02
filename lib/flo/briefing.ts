// 플로(Flo) Briefing 생성 — 수집된 FloContext 를 프롬프트로 직렬화 → Claude 1회 호출 →
// structured JSON 파싱. 숫자 인용 가드(ADR-031/030 대칭): 플로는 우리가 계산한 값만 인용. server-side only.

import { generateClaudeText } from "@/lib/claude-client";
import { generateGeminiText } from "@/lib/gemini-client";
import type { Briefing, Finding, FindingSeverity, FloContext, FloModel } from "./types";

const SYSTEM = `너는 "플로(Flo)", AdFlow 의 AI 마케팅 코치야. 인하우스 비전문 마케터가 "지금 뭘 해야 하나"를 한눈에 알도록, 흩어진 신호를 이어서 진단해.

규칙:
- 아래 [데이터]에 주어진 숫자만 인용해. 새로운 수치·비율을 절대 지어내지 마. 데이터에 없는 값은 정성적으로만 말해.
- 우리가 이미 계산한 룰 판정(가짜 성과 의심·채널 제안)을 근거로 삼아 "왜"를 설명해.
- 각 Finding 은 진단(왜 이런가) → 제안(무엇을 하라) → 대안(있으면 다른 선택지)으로 나눠 써.
- 한국어. 친근하고 간결하게. 과장 금지.
- Finding 은 3~6개. 가장 중요한 것부터.
- action.href 는 다음 중 관련 있을 때만: /create(새 캠페인) · /ab-tests(A/B 테스트) · /brand-profile(브랜드) · /campaigns(캠페인 목록).

출력은 아래 JSON 객체 하나. 코드펜스·설명 없이 JSON 만:
{
  "headline": "계정 상태 한 줄 요약",
  "findings": [
    {
      "severity": "good" | "info" | "warn",
      "title": "짧은 제목",
      "diagnosis": "왜 이런가 — 데이터 신호 인용",
      "suggestion": "권장 조치",
      "alternative": "대안 (없으면 생략)",
      "action": { "label": "버튼 텍스트", "href": "/create" }
    }
  ]
}`;

function num(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function buildPrompt(ctx: FloContext): string {
  const lines: string[] = ["[데이터] 활성 광고 계정 기준 횡단 요약이야.\n"];

  if (ctx.brand) {
    const b = ctx.brand;
    lines.push("## 브랜드");
    if (b.name) lines.push(`- 이름: ${b.name}`);
    if (b.brandDescription) lines.push(`- 설명: ${b.brandDescription}`);
    if (b.tone) lines.push(`- 톤: ${b.tone}`);
    if (b.brandVoice) lines.push(`- 보이스: ${b.brandVoice}`);
    if (b.proofPoints?.length) lines.push(`- 근거 자료(Proof Point): ${b.proofPoints.join(" / ")}`);
    lines.push("");
  }

  lines.push("## 광고 성과 (최근 30일, 노출 발생 캠페인)");
  if (ctx.campaigns.length === 0) {
    lines.push("- 집계할 광고 성과가 없어요.");
  } else {
    for (const c of ctx.campaigns) {
      lines.push(
        `- "${c.headline}" [${c.objective}/${c.status}] 노출 ${num(c.impressions)} · 클릭 ${num(c.clicks)} · CTR ${c.ctr}% · 지출 ₩${num(c.spend)}${c.dailyBudget != null ? ` · 일일예산 ₩${num(c.dailyBudget)}` : ""}` +
          (c.fakePerformance ? `\n    ⚠️ 룰 판정: ${c.fakePerformance}` : ""),
      );
    }
  }
  lines.push("");

  for (const ch of [ctx.instagram, ctx.facebook]) {
    if (!ch) continue;
    lines.push(`## ${ch.channel === "instagram" ? "인스타그램" : "페이스북"} 오가닉`);
    lines.push(`- 팔로워 ${num(ch.followers)} · 인게이지먼트율 ${ch.engagementRate}%`);
    if (ch.suggestions.length) lines.push(`- 룰 제안: ${ch.suggestions.join(" / ")}`);
    lines.push("");
  }

  lines.push("## 진행 중 A/B 토너먼트");
  if (ctx.tournaments.length === 0) {
    lines.push("- 진행 중인 토너먼트가 없어요.");
  } else {
    for (const t of ctx.tournaments) {
      lines.push(
        `- "${t.productName}" [${t.objective}] ${t.round}라운드 진행 중${t.latestVerdict ? ` · 최근 판정: ${t.latestVerdict}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

const SEVERITIES: FindingSeverity[] = ["good", "info", "warn"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseFinding(raw: unknown): Finding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = str(o.title);
  const diagnosis = str(o.diagnosis);
  const suggestion = str(o.suggestion);
  if (!title || !diagnosis || !suggestion) return null;

  const severity: FindingSeverity = SEVERITIES.includes(o.severity as FindingSeverity)
    ? (o.severity as FindingSeverity)
    : "info";
  const alternative = str(o.alternative) || undefined;

  let action: Finding["action"];
  const a = o.action;
  if (a && typeof a === "object") {
    const label = str((a as Record<string, unknown>).label);
    const href = str((a as Record<string, unknown>).href);
    if (label && href.startsWith("/")) action = { label, href };
  }

  return { severity, title, diagnosis, suggestion, alternative, action };
}

export function parseBriefing(text: string): { headline: string; findings: Finding[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("플로 응답을 읽지 못했어요. 다시 시도해주세요.");
  }
  const o = (parsed ?? {}) as Record<string, unknown>;
  const headline = str(o.headline);
  const findings = (Array.isArray(o.findings) ? o.findings : [])
    .map(parseFinding)
    .filter((f): f is Finding => f !== null);

  if (!headline || findings.length === 0) {
    throw new Error("플로 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
  }
  return { headline, findings };
}

export async function generateBriefing(
  ctx: FloContext,
  model: FloModel,
): Promise<Pick<Briefing, "model" | "headline" | "findings">> {
  const prompt = buildPrompt(ctx);
  const text =
    model === "gemini"
      ? await generateGeminiText(prompt, { systemInstruction: SYSTEM, json: true })
      : await generateClaudeText(prompt, { model, systemInstruction: SYSTEM, json: true });
  const { headline, findings } = parseBriefing(text);
  return { model, headline, findings };
}
