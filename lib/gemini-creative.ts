// Server-side only — do not import from 'use client' components; GOOGLE_AI_API_KEY would be exposed.

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  type ToneId,
  TONE_PROMPT_DESC,
  OBJECTIVES_ALL,
  type ObjectiveId,
} from "@entities/creative/options";
import { AD_COPYWRITER_SYSTEM_PROMPT } from "@/lib/prompts/ad-copywriter";

export interface GenerateCreativeParams {
  brand: string;
  target: string;
  tone: ToneId;
  outcome: ObjectiveId;
  hint?: string;
}

// Meta spec: 1=male, 2=female, [] = all (unspecified)
export interface ExtractedTargeting {
  ageMin: number;
  ageMax: number;
  genders: number[];
}

export interface GenerateCreativeResult {
  headlines: [string, string, string];
  primaryText: string;
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

const PROMPT = (p: GenerateCreativeParams) => {
  const outcomeDef = OBJECTIVES_ALL.find((o) => o.id === p.outcome)!;
  const hintLine = p.hint?.trim() ? `\n추가 요청: ${p.hint.trim()}` : "";
  return `
아래 정보를 바탕으로 Facebook/Instagram 광고 소재를 작성해주세요.

브랜드/제품: ${p.brand}
타겟 오디언스: ${p.target}
톤앤매너: ${TONE_PROMPT_DESC[p.tone]}
원하는 결과: ${outcomeDef.outcomeLabel} (Meta ${outcomeDef.metaObjective})
카피 방향: ${outcomeDef.copyTone}${hintLine}

다음 JSON 형식으로 응답하세요:
{
  "headlines": ["헤드라인1 (25자 이내)", "헤드라인2 (25자 이내)", "헤드라인3 (25자 이내)"],
  "primaryText": "본문 (150~200자, 공감→문제→해결→증거→CTA 구조)",
  "targeting": {
    "ageMin": 최소연령(18~65 정수),
    "ageMax": 최대연령(18~65 정수),
    "genders": 특정성별이면 [1](남) 또는 [2](여), 아니면 []
  }
}
`.trim();
};

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
  tone: ToneId;
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
톤앤매너: ${TONE_PROMPT_DESC[p.tone]}

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
    const text = await generateWithFallback(apiKey, PROMPT(params));

    let parsed: {
      headlines: string[];
      primaryText: string;
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
      typeof parsed.primaryText !== "string" ||
      !parsed.primaryText
    ) {
      throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
    }

    return {
      headlines: [
        stripHanja(parsed.headlines[0]),
        stripHanja(parsed.headlines[1]),
        stripHanja(parsed.headlines[2]),
      ],
      primaryText: stripHanja(parsed.primaryText),
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
