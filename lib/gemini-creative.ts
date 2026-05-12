// Gemini Creative 모듈 (Server-side 전용)
// 'use client' 컴포넌트에서 import 금지 — GOOGLE_AI_API_KEY 가 노출돼요.
// DEEPENING.md 카테고리 4 (True External): Port 인터페이스 + HttpAdapter 패턴

import { GoogleGenerativeAI } from "@google/generative-ai";
import { type ToneId, TONE_PROMPT_DESC } from "./creative-options";

/* ── Types (Port interface) ─────────────────────────────────────── */

export interface GenerateCreativeParams {
  brand: string;
  target: string;
  goal: string;
  tone: ToneId;
}

// genders: Meta 규격 — 1=남성, 2=여성, [] = 전체(특정하지 않음)
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
  const t = (raw ?? {}) as { ageMin?: unknown; ageMax?: unknown; genders?: unknown };
  let ageMin = Math.round(Number(t.ageMin));
  let ageMax = Math.round(Number(t.ageMax));
  if (!Number.isFinite(ageMin)) ageMin = AGE_FLOOR;
  if (!Number.isFinite(ageMax)) ageMax = AGE_CEIL;
  ageMin = Math.max(AGE_FLOOR, Math.min(AGE_CEIL, ageMin));
  ageMax = Math.max(AGE_FLOOR, Math.min(AGE_CEIL, ageMax));
  if (ageMin >= ageMax) { ageMin = AGE_FLOOR; ageMax = AGE_CEIL; }
  const list = Array.isArray(t.genders) ? t.genders.map(Number).filter((g) => g === 1 || g === 2) : [];
  const uniq = Array.from(new Set(list));
  // [1,2] 는 "전체"와 동일 — [] 로 정규화
  return { ageMin, ageMax, genders: uniq.length === 2 ? [] : uniq };
}

/* ── Internal helpers ───────────────────────────────────────────── */

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} 가 .env.local 에 설정되지 않았어요.`);
  return v;
}

const PROMPT = (p: GenerateCreativeParams) =>
  `
당신은 한국 디지털 광고 카피라이터입니다.
아래 정보를 바탕으로 Facebook/Instagram 광고 소재를 작성해주세요.

브랜드/제품: ${p.brand}
타겟 오디언스: ${p.target}
광고 목표: ${p.goal}
톤앤매너: ${TONE_PROMPT_DESC[p.tone]}

다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "headlines": [
    "헤드라인 1 (20자 이내)",
    "헤드라인 2 (20자 이내)",
    "헤드라인 3 (20자 이내)"
  ],
  "primaryText": "기본 텍스트 (100자 이내, 핵심 메시지와 CTA 포함)",
  "targeting": {
    "ageMin": "타겟 오디언스 설명에서 추정한 최소 연령(18~65 정수). 모르면 18",
    "ageMax": "타겟 오디언스 설명에서 추정한 최대 연령(18~65 정수). 모르면 65",
    "genders": "광고가 명확히 특정 성별 대상이면 [1](남성) 또는 [2](여성), 둘 다이거나 불명확하면 []"
  }
}
`.trim();

/* ── Retry helper ───────────────────────────────────────────────── */

const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

function is503(err: unknown): boolean {
  return err instanceof Error && err.message.includes("503");
}

async function generateWithFallback(
  apiKey: string,
  prompt: string,
): Promise<string> {
  for (const modelName of TEXT_MODELS) {
    try {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelName,
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
  throw new Error("모든 AI 모델이 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요.");
}

/* ── Image Prompt Suggestion ────────────────────────────────────── */

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

/* ── HttpAdapter (Port 구현체) ─────────────────────────────────── */

export const geminiCreative = {
  get isConfigured() {
    return !!process.env.GOOGLE_AI_API_KEY;
  },

  async generate(params: GenerateCreativeParams): Promise<GenerateCreativeResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(apiKey, PROMPT(params));
    let parsed: { headlines: string[]; primaryText: string; targeting?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
    }

    if (
      !Array.isArray(parsed.headlines) ||
      parsed.headlines.length < 3 ||
      parsed.headlines.slice(0, 3).some((h: unknown) => typeof h !== 'string' || !h) ||
      typeof parsed.primaryText !== 'string' ||
      !parsed.primaryText
    ) {
      throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
    }

    return {
      headlines: [parsed.headlines[0], parsed.headlines[1], parsed.headlines[2]],
      primaryText: parsed.primaryText,
      targeting: sanitizeTargeting(parsed.targeting),
    };
  },

  async suggestImagePrompt(params: SuggestImagePromptParams): Promise<SuggestImagePromptResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(apiKey, IMAGE_PROMPT_TEMPLATE(params));
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
