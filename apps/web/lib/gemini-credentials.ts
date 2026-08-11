// Server-side only — Gemini API 키는 .adflow 에 암호화해 보관하고 환경변수를 폴백으로 사용한다.

import { promises as fs } from "node:fs";
import path from "node:path";
import { decrypt, encrypt, getDataDir } from "./meta-credentials";

export type GeminiKeySource = "saved" | "env" | null;

function keyFile(): string {
  return path.join(getDataDir(), "gemini-api-key.enc");
}

async function savedKey(): Promise<string | null> {
  try {
    return decrypt((await fs.readFile(keyFile(), "utf8")).trim()).trim() || null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function getGeminiApiKey(): Promise<string | null> {
  return (await savedKey()) ?? process.env.GOOGLE_AI_API_KEY?.trim() ?? null;
}

export async function getGeminiKeySource(): Promise<GeminiKeySource> {
  if (await savedKey()) return "saved";
  return process.env.GOOGLE_AI_API_KEY?.trim() ? "env" : null;
}

export async function setGeminiApiKey(apiKey: string): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(keyFile(), encrypt(apiKey), { mode: 0o600 });
}
