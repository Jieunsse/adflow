// Server-side only — do not import from 'use client' components; ANTHROPIC_API_KEY would be exposed.
// 플로(Flo) 전용 Claude 클라이언트 — env 검증·모델 선택·에러 폴백을 단일 출처로. gemini-client.ts 대칭.

import Anthropic from "@anthropic-ai/sdk";

const API_KEY_ENV = "ANTHROPIC_API_KEY";

const MODELS = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
} as const;

export type ClaudeModel = keyof typeof MODELS;

const DEFAULT_MAX_TOKENS = 4096;

export function isClaudeConfigured(): boolean {
  return !!process.env[API_KEY_ENV];
}

export function requireClaudeKey(): string {
  const v = process.env[API_KEY_ENV];
  if (!v) throw new Error(`${API_KEY_ENV} 가 .env.local 에 설정되지 않았어요.`);
  return v;
}

// Anthropic 과부하(529)·일시 장애(503) 는 한 번 더 시도, 그 외/재시도 실패는 throw.
function isOverloaded(err: unknown): boolean {
  return err instanceof Anthropic.APIError && (err.status === 529 || err.status === 503);
}

export interface GenerateTextOptions {
  model?: ClaudeModel; // 기본 sonnet, 깊은 진단은 opus
  systemInstruction?: string;
  json?: boolean; // JSON only 출력 강제 (Gemini json 모드 대칭)
  maxTokens?: number;
}

export async function generateClaudeText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  const apiKey = requireClaudeKey();
  const client = new Anthropic({ apiKey });
  const model = MODELS[options.model ?? "sonnet"];

  const system = options.json
    ? [options.systemInstruction, "유효한 JSON 객체 하나만 출력해요. 코드펜스·설명 텍스트 금지."]
        .filter(Boolean)
        .join("\n\n")
    : options.systemInstruction;

  // json 모드: assistant 턴을 "{" 로 prefill 해 JSON 시작을 강제하고, 응답 앞에 다시 붙인다.
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
    ...(options.json ? [{ role: "assistant" as const, content: "{" }] : []),
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.messages.create({
        model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(system ? { system } : {}),
        messages,
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return options.json ? `{${text}` : text;
    } catch (err) {
      if (isOverloaded(err) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
  throw new Error("AI 가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요.");
}
