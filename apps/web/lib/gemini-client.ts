// Server-side only — do not import from 'use client' components; GOOGLE_AI_API_KEY would be exposed.
// gemini 텍스트 모듈 공용 클라이언트 — env 검증·503 폴백을 단일 출처로.

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY_ENV = "GOOGLE_AI_API_KEY";
const TEXT_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

export function isGeminiConfigured(): boolean {
  return !!process.env[API_KEY_ENV];
}

export function requireGeminiKey(): string {
  const v = process.env[API_KEY_ENV];
  if (!v) throw new Error(`${API_KEY_ENV} 가 .env.local 에 설정되지 않았어요.`);
  return v;
}

function is503(err: unknown): boolean {
  return err instanceof Error && err.message.includes("503");
}

export interface GenerateTextOptions {
  systemInstruction?: string;
  json?: boolean; // responseMimeType: application/json
}

// 앞 모델이 503 이면 잠시 뒤 다음 모델로 폴백. 마지막 모델 503·기타 에러는 throw.
export async function generateGeminiText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  const apiKey = requireGeminiKey();
  for (const modelName of TEXT_MODELS) {
    try {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelName,
        ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
        ...(options.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
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
