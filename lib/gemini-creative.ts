// Server-side only — do not import from 'use client' components; GOOGLE_AI_API_KEY would be exposed.

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  type ToneId,
  TONE_PROMPT_DESC,
  OBJECTIVES_ALL,
  type ObjectiveId,
} from "@entities/creative/options";

function toneText(tone: string): string {
  return TONE_PROMPT_DESC[tone as ToneId] ?? tone;
}
import { AD_COPYWRITER_SYSTEM_PROMPT } from "@/lib/prompts/ad-copywriter";
import type { SopSection } from "@features/sop/model/useSopStorage";

export interface BrandProfileContext {
  brandDescription?: string;
  brandVoice?: string;
  customerVoiceSummary?: string;
  prohibitedWords?: string;
  requiredPhrases?: string;
  requiredHashtags?: string;
  policy?: SopSection[];
}

export interface PersonaContext {
  name: string;
  customerDescription?: string;
  interests?: string[];
}

export interface GenerateCreativeParams {
  brand: string;
  target?: string;
  tone: string;
  outcome: ObjectiveId;
  hint?: string;
  brandProfile?: BrandProfileContext;
  persona?: PersonaContext;
}

// Meta spec: 1=male, 2=female, [] = all (unspecified)
export interface ExtractedTargeting {
  ageMin: number;
  ageMax: number;
  genders: number[];
}

export interface GenerateCreativeResult {
  headlines: [string, string, string];
  primaryTexts: [string, string, string];
  targeting: ExtractedTargeting;
}

const AGE_FLOOR = 18;
const AGE_CEIL = 65;

function sanitizeTargeting(raw: unknown): ExtractedTargeting {
  const t = (raw ?? {}) as {
    ageMin?: unknown;
    ageMax?: unknown;
    genders?: unknown;
  };
  let ageMin = Math.round(Number(t.ageMin));
  let ageMax = Math.round(Number(t.ageMax));
  if (!Number.isFinite(ageMin)) ageMin = AGE_FLOOR;
  if (!Number.isFinite(ageMax)) ageMax = AGE_CEIL;
  ageMin = Math.max(AGE_FLOOR, Math.min(AGE_CEIL, ageMin));
  ageMax = Math.max(AGE_FLOOR, Math.min(AGE_CEIL, ageMax));
  if (ageMin >= ageMax) {
    ageMin = AGE_FLOOR;
    ageMax = AGE_CEIL;
  }
  const list = Array.isArray(t.genders)
    ? t.genders.map(Number).filter((g) => g === 1 || g === 2)
    : [];
  const uniq = Array.from(new Set(list));
  // [1,2] is equivalent to "all" — normalise to []
  return { ageMin, ageMax, genders: uniq.length === 2 ? [] : uniq };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} 가 .env.local 에 설정되지 않았어요.`);
  return v;
}

function buildPolicyLines(bp: BrandProfileContext): string {
  const styleProhibited = bp.prohibitedWords?.trim() ?? "";
  const policyProhibited = bp.policy
    ?.find((s): s is Extract<SopSection, { type: "prohibited_words" }> => s.type === "prohibited_words")
    ?.data.words.join(", ") ?? "";
  const allProhibited = [styleProhibited, policyProhibited].filter(Boolean).join(", ");
  const prohibitedLine = allProhibited ? `\n금지어 (절대 사용 금지): ${allProhibited}` : "";

  const lengthSection = bp.policy?.find(
    (s): s is Extract<SopSection, { type: "length_limits" }> => s.type === "length_limits",
  );
  let lengthLine = "";
  if (lengthSection) {
    const parts: string[] = [];
    if (lengthSection.data.headline != null) parts.push(`헤드라인 ${lengthSection.data.headline}자 이내`);
    if (lengthSection.data.body != null) parts.push(`본문 ${lengthSection.data.body}자 이내`);
    if (lengthSection.data.hashtagCount != null) parts.push(`해시태그 ${lengthSection.data.hashtagCount}개 이내`);
    if (parts.length) lengthLine = `\n글자 제한: ${parts.join(", ")}`;
  }

  const ctaSection = bp.policy?.find(
    (s): s is Extract<SopSection, { type: "cta_restrictions" }> => s.type === "cta_restrictions",
  );
  let ctaLine = "";
  if (ctaSection) {
    const parts: string[] = [];
    if (ctaSection.data.blacklist.length) parts.push(`금지 CTA: ${ctaSection.data.blacklist.join(", ")}`);
    if (ctaSection.data.note?.trim()) parts.push(ctaSection.data.note.trim());
    if (parts.length) ctaLine = `\nCTA 제한: ${parts.join(" / ")}`;
  }

  const requiredPhrasesLine = bp.requiredPhrases?.trim() ? `\n반드시 포함할 문구: ${bp.requiredPhrases.trim()}` : "";
  const requiredHashtagsLine = bp.requiredHashtags?.trim() ? `\n필수 해시태그 (Instagram): ${bp.requiredHashtags.trim()}` : "";

  return prohibitedLine + lengthLine + ctaLine + requiredPhrasesLine + requiredHashtagsLine;
}

export function buildCreativePrompt(p: GenerateCreativeParams): string {
  const outcomeDef = OBJECTIVES_ALL.find((o) => o.id === p.outcome)!;
  const hintLine = p.hint?.trim() ? `\n추가 요청: ${p.hint.trim()}` : "";
  const bp = p.brandProfile;

  const brandLine = bp?.brandDescription?.trim() ?? p.brand;
  const brandVoiceLine = bp?.brandVoice?.trim() ? `\n브랜드 보이스: ${bp.brandVoice.trim()}` : "";

  const audienceLine = p.persona?.customerDescription?.trim() || p.target?.trim() || p.persona?.name || "";
  const customerVoiceLine = bp?.customerVoiceSummary?.trim() ? `\n고객 언어: ${bp.customerVoiceSummary.trim()}` : "";
  const personaInterestsLine = p.persona?.interests?.length
    ? `\n관심 키워드: ${p.persona.interests.join(", ")}`
    : "";

  const policyLines = bp ? buildPolicyLines(bp) : "";

  return `
아래 정보를 바탕으로 Facebook/Instagram 광고 소재를 작성해주세요.

브랜드/제품: ${brandLine}${brandVoiceLine}
타겟 오디언스: ${audienceLine}${customerVoiceLine}${personaInterestsLine}
톤앤매너: ${toneText(p.tone)}
원하는 결과: ${outcomeDef.outcomeLabel} (Meta ${outcomeDef.metaObjective})
카피 방향: ${outcomeDef.copyTone}${hintLine}${policyLines}

다음 JSON 형식으로 응답하세요:
{
  "headlines": ["헤드라인1 (25자 이내)", "헤드라인2 (25자 이내)", "헤드라인3 (25자 이내)"],
  "primaryTexts": [
    "본문1 (150~200자, 공감→문제→해결→증거→CTA 구조)",
    "본문2 (다른 감성·각도로 150~200자)",
    "본문3 (또 다른 접근 150~200자)"
  ],
  "targeting": {
    "ageMin": 최소연령(18~65 정수),
    "ageMax": 최대연령(18~65 정수),
    "genders": 특정성별이면 [1](남) 또는 [2](여), 아니면 []
  }
}
`.trim();
}

const TEXT_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];

function is503(err: unknown): boolean {
  return err instanceof Error && err.message.includes("503");
}

// CJK Unified Ideographs 범위(U+4E00–U+9FFF)의 한자를 제거해요.
function stripHanja(text: string): string {
  return text.replace(/[一-鿿]/g, "");
}


async function generateWithFallback(
  apiKey: string,
  prompt: string,
): Promise<string> {
  for (const modelName of TEXT_MODELS) {
    try {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelName,
        systemInstruction: AD_COPYWRITER_SYSTEM_PROMPT,
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (is503(err) && modelName !== TEXT_MODELS[TEXT_MODELS.length - 1]) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    "모든 AI 모델이 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요.",
  );
}

export interface SuggestImagePromptParams {
  headline: string;
  primaryText: string;
  tone: string;
}

export interface SuggestImagePromptResult {
  prompt: string;
}

const IMAGE_PROMPT_TEMPLATE = (p: SuggestImagePromptParams) =>
  `
당신은 AI 이미지 생성 전문가입니다.
아래 Facebook/Instagram 광고 카피를 보고, 이 광고에 어울리는 이미지 생성 프롬프트를 영어로 작성해주세요.

광고 헤드라인: ${p.headline}
광고 본문: ${p.primaryText}
톤앤매너: ${toneText(p.tone)}

규칙:
- 1:1 정사각형 광고 이미지에 적합한 구도
- 이미지 안에 텍스트·로고·글자를 넣지 않는 클린 비주얼
- 제품/라이프스타일/무드 등 광고 카피의 분위기를 살린 장면
- 영어로 작성, 100단어 이내

다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요:
{"prompt": "생성할 이미지 프롬프트 (영어)"}
`.trim();

export const geminiCreative = {
  get isConfigured() {
    return !!process.env.GOOGLE_AI_API_KEY;
  },

  async generate(
    params: GenerateCreativeParams,
  ): Promise<GenerateCreativeResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(apiKey, buildCreativePrompt(params));

    let parsed: {
      headlines: string[];
      primaryTexts: string[];
      targeting?: unknown;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
    }

    if (
      !Array.isArray(parsed.headlines) ||
      parsed.headlines.length < 3 ||
      parsed.headlines
        .slice(0, 3)
        .some((h: unknown) => typeof h !== "string" || !h) ||
      !Array.isArray(parsed.primaryTexts) ||
      parsed.primaryTexts.length < 3 ||
      parsed.primaryTexts
        .slice(0, 3)
        .some((t: unknown) => typeof t !== "string" || !t)
    ) {
      throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
    }

    return {
      headlines: [
        stripHanja(parsed.headlines[0]),
        stripHanja(parsed.headlines[1]),
        stripHanja(parsed.headlines[2]),
      ],
      primaryTexts: [
        stripHanja(parsed.primaryTexts[0]),
        stripHanja(parsed.primaryTexts[1]),
        stripHanja(parsed.primaryTexts[2]),
      ],
      targeting: sanitizeTargeting(parsed.targeting),
    };
  },

  async suggestImagePrompt(
    params: SuggestImagePromptParams,
  ): Promise<SuggestImagePromptResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(
      apiKey,
      IMAGE_PROMPT_TEMPLATE(params),
    );
    let parsed: { prompt?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
    }
    if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
      throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
    }
    return { prompt: parsed.prompt.trim() };
  },
};
