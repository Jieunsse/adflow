import { describe, it, expect } from "vitest";
import { buildBriefPrompt, type BriefPromptInput } from "./brief-prompt";

const base: BriefPromptInput = {
  headline: "헤드라인",
  primaryText: "",
  tone: "친근함",
  outcomeChip: null,
  scenesCount: 0,
  hasLogo: false,
  aspect: "1:1",
  notes: "",
};

describe("buildBriefPrompt", () => {
  it("imageGuide 있으면 프롬프트에 포함", () => {
    const p = buildBriefPrompt({ ...base, imageGuide: "따뜻한 파스텔톤, 자연광 위주" });
    expect(p).toContain("브랜드 이미지 가이드: 따뜻한 파스텔톤, 자연광 위주");
  });

  it("imageGuide 없으면 해당 줄 생략", () => {
    const p = buildBriefPrompt(base);
    expect(p).not.toContain("브랜드 이미지 가이드");
  });

  it("imageGuide 공백만 있으면 생략", () => {
    const p = buildBriefPrompt({ ...base, imageGuide: "   " });
    expect(p).not.toContain("브랜드 이미지 가이드");
  });
});
