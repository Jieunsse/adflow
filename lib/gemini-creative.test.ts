import { describe, expect, it } from "vitest";
import { buildCreativePrompt } from "./gemini-creative";
import type { GenerateCreativeParams } from "./gemini-creative";

const BASE: GenerateCreativeParams = {
  brand: "테스트 브랜드",
  tone: "pro",
  outcome: "traffic",
};

describe("buildCreativePrompt — persona 주입", () => {
  it("persona 없을 때 target 자유텍스트 사용", () => {
    const prompt = buildCreativePrompt({ ...BASE, target: "20대 여성" });
    expect(prompt).toContain("타겟 오디언스: 20대 여성");
    expect(prompt).not.toContain("타겟 고객 맥락:");
    expect(prompt).not.toContain("관심 키워드:");
  });

  it("persona 있고 customerDescription 있을 때 customerDescription 이 오디언스 라인", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      persona: {
        name: "20대 직장여성",
        customerDescription: "피부 트러블에 민감한 고객",
        interests: ["뷰티", "헬스케어"],
      },
    });
    // ADR-022 / issue#12 — customerDescription 이 타겟 오디언스 라인의 기본값
    expect(prompt).toContain("타겟 오디언스: 피부 트러블에 민감한 고객");
    expect(prompt).not.toContain("타겟 고객 맥락:");
    expect(prompt).toContain("관심 키워드: 뷰티, 헬스케어");
  });

  it("persona 있고 customerDescription 없을 때 맥락 줄 미포함", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      persona: { name: "30대 남성" },
    });
    expect(prompt).toContain("타겟 오디언스: 30대 남성");
    expect(prompt).not.toContain("타겟 고객 맥락:");
  });

  it("persona 있고 interests 빈 배열이면 관심 키워드 줄 미포함", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      persona: { name: "전체", interests: [] },
    });
    expect(prompt).not.toContain("관심 키워드:");
  });

  it("target과 persona 모두 있으면 target 자유텍스트 우선", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      target: "자유 입력 타겟",
      persona: { name: "페르소나 이름" },
    });
    expect(prompt).toContain("타겟 오디언스: 자유 입력 타겟");
  });
});
