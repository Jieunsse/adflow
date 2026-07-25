// Server-side only. IG 포스트 페이지 전용 — 캡션 / 이미지 프롬프트를 짧게 제안.

import { generateGeminiText, isGeminiConfigured } from "./gemini-client";

function stripHanja(text: string): string {
  return text.replace(/[一-鿿]/g, "");
}

export interface BrandContext {
  tone?: string;
  brandVoice?: string;
  customerVoiceSummary?: string;
  imageGuide?: string;
  personaDescription?: string;
}

function buildBrandSection(ctx: BrandContext | undefined): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.tone) lines.push(`- 톤: ${ctx.tone}`);
  if (ctx.brandVoice) lines.push(`- 브랜드 보이스: ${ctx.brandVoice}`);
  if (ctx.customerVoiceSummary) lines.push(`- 고객 목소리: ${ctx.customerVoiceSummary}`);
  if (ctx.personaDescription) lines.push(`- 타겟 고객: ${ctx.personaDescription}`);
  return lines.length ? `\n브랜드 컨텍스트:\n${lines.join("\n")}\n` : "";
}

const CAPTION_PROMPT = (hint: string, ctx?: BrandContext) => `
당신은 한국 시장 SNS 카피라이터예요. 인스타그램 오가닉 포스트 캡션 1개를 만들어주세요.
${buildBrandSection(ctx)}
힌트: ${hint || "(없음) — 위 브랜드 컨텍스트에 맞는 매력적인 캡션으로"}

규칙:
- 한국어, 자연스러운 구어체. 150~250자.
- 마지막 줄에 해시태그 3~5개 (# 포함, 한글/영문).
- 광고스럽지 않게.

JSON 만 출력:
{ "caption": "본문\\n\\n#태그1 #태그2 ..." }
`;

const IMAGE_PROMPT_PROMPT = (hint: string, caption: string, ctx?: BrandContext) => `
당신은 SNS 이미지 디렉터예요. 인스타그램 피드 1:1 정사각 이미지를 위한 이미지 생성 프롬프트 1개를 만들어주세요.
${ctx?.imageGuide ? `\n이미지 가이드: ${ctx.imageGuide}\n` : ""}${ctx?.personaDescription ? `타겟 고객: ${ctx.personaDescription}\n` : ""}
${caption ? `참고 캡션:\n${caption}\n` : ""}힌트: ${hint || "(없음)"}

규칙:
- 한국어 1~2문장. 80자 이내.
- 피사체 / 분위기 / 조명 / 색감을 구체적으로.
- 텍스트·로고 언급 금지.

JSON 만 출력:
{ "prompt": "..." }
`;

export const geminiPostSuggest = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async suggestCaption(hint: string, ctx?: BrandContext): Promise<string> {
    const text = await generateGeminiText(CAPTION_PROMPT(hint, ctx), { json: true });
    let parsed: { caption?: unknown };
    try { parsed = JSON.parse(text); } catch { throw new Error("AI 응답을 파싱할 수 없어요."); }
    const caption = typeof parsed.caption === "string" ? stripHanja(parsed.caption).trim() : "";
    if (!caption) throw new Error("AI 응답 형식이 올바르지 않아요.");
    return caption;
  },

  async suggestImagePrompt(hint: string, caption: string, ctx?: BrandContext): Promise<string> {
    const text = await generateGeminiText(IMAGE_PROMPT_PROMPT(hint, caption, ctx), { json: true });
    let parsed: { prompt?: unknown };
    try { parsed = JSON.parse(text); } catch { throw new Error("AI 응답을 파싱할 수 없어요."); }
    const prompt = typeof parsed.prompt === "string" ? stripHanja(parsed.prompt).trim() : "";
    if (!prompt) throw new Error("AI 응답 형식이 올바르지 않아요.");
    return prompt;
  },
};
