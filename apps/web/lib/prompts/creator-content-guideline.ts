// PRD-influencer-marketing.md §6 — 콘텐츠 가이드라인 초안 (Gemini). Server-side only.
// ADR-031 — 입력에 없는 수치(할인율·성과 약속 등) 지어내기 금지.

import { generateGeminiText, isGeminiConfigured } from "@/lib/gemini-client";

export interface GuidelineBrandSummary {
  name: string;
  description?: string;
}

export interface GuidelineCampaign {
  name: string;
  goal: string;
  product?: string;
}

export interface GenerateContentGuidelineParams {
  brand: GuidelineBrandSummary;
  campaign: GuidelineCampaign;
  platform: string;
}

export interface GenerateContentGuidelineResult {
  mustInclude: string[];
  tone: string;
  dosDonts: string[];
  caption: string;
}

const SYSTEM = `너는 브랜드 마케팅 담당자를 대신해 협업 크리에이터에게 전달할 콘텐츠 제작 가이드라인을 쓰는 담당자야.

규칙:
- 입력에 없는 수치(할인율·비용·성과 약속 등)를 절대 지어내지 마.
- mustInclude 는 콘텐츠에 반드시 들어가야 할 요소(제품 노출 방식·핵심 메시지·해시태그류) 3~5개.
- tone 은 콘텐츠 톤앤매너를 한 문장으로.
- dosDonts 는 "~하세요"/"~은 피해주세요" 형태의 지침 4~6개(Do·Don't 섞어서).
- caption 은 크리에이터가 참고할 캡션 예시 초안 1개(실제 게시용 아님, 참고 샘플).

출력은 아래 JSON 객체 하나. 코드펜스·설명 없이 JSON 만:
{
  "mustInclude": ["...", "..."],
  "tone": "...",
  "dosDonts": ["...", "..."],
  "caption": "..."
}`;

function buildPrompt(p: GenerateContentGuidelineParams): string {
  const lines: string[] = [];
  lines.push(`브랜드: ${p.brand.name}`);
  if (p.brand.description?.trim()) lines.push(`브랜드 소개: ${p.brand.description.trim()}`);
  lines.push(`캠페인: ${p.campaign.name}`);
  lines.push(`캠페인 목표: ${p.campaign.goal}`);
  if (p.campaign.product?.trim()) lines.push(`대상 제품: ${p.campaign.product.trim()}`);
  lines.push(`플랫폼: ${p.platform}`);
  return lines.join("\n");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
}

export function parseGuideline(text: string): GenerateContentGuidelineResult {
  let parsed: { mustInclude?: unknown; tone?: unknown; dosDonts?: unknown; caption?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
  }
  const mustInclude = strArray(parsed.mustInclude);
  const tone = str(parsed.tone);
  const dosDonts = strArray(parsed.dosDonts);
  const caption = str(parsed.caption);
  if (!mustInclude.length || !tone || !dosDonts.length || !caption) {
    throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
  }
  return { mustInclude, tone, dosDonts, caption };
}

export const creatorContentGuideline = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async generate(params: GenerateContentGuidelineParams): Promise<GenerateContentGuidelineResult> {
    const text = await generateGeminiText(buildPrompt(params), {
      systemInstruction: SYSTEM,
      json: true,
    });
    return parseGuideline(text);
  },
};
