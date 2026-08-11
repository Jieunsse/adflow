import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getGeminiApiKey, getGeminiKeySource, setGeminiApiKey } from "./gemini-credentials";

let dataDir: string;

beforeEach(async () => {
  process.env.NEXTAUTH_SECRET = "gemini-credentials-test-secret";
  dataDir = await mkdtemp(path.join(tmpdir(), "adflow-gemini-"));
  process.env.ADFLOW_DATA_DIR = dataDir;
  delete process.env.GOOGLE_AI_API_KEY;
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
  delete process.env.ADFLOW_DATA_DIR;
});

describe("Gemini API 키 저장소", () => {
  it("저장한 키가 환경변수보다 우선해요", async () => {
    process.env.GOOGLE_AI_API_KEY = "env-key";
    await setGeminiApiKey("saved-key");

    expect(await getGeminiApiKey()).toBe("saved-key");
    expect(await getGeminiKeySource()).toBe("saved");
  });
});
