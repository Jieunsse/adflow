import { describe, expect, it } from "vitest";
import { buildCreativePrompt, parseImageConcepts, filterOverlayHeadlines } from "./gemini-creative";
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

describe("buildCreativePrompt — 카피 훅 주입 (ADR-029)", () => {
  it("hooks 미지정 시 outcome 추천 풀이 변형별로 주입된다", () => {
    // traffic → Number / Trust / Benefit
    const prompt = buildCreativePrompt({ ...BASE, target: "20대" });
    expect(prompt).toContain("카피 훅:");
    expect(prompt).toContain("본문1 = Number");
    expect(prompt).toContain("본문2 = Trust");
    expect(prompt).toContain("본문3 = Benefit");
  });

  it("hooks 3개 지정 시 그 훅이 변형 순서대로 주입된다", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      target: "20대",
      hooks: ["story", "rush", "unique"],
    });
    expect(prompt).toContain("본문1 = Story");
    expect(prompt).toContain("본문2 = Rush");
    expect(prompt).toContain("본문3 = Unique");
  });

  it("primaryTexts JSON 가이드에 각 변형의 훅 라벨이 붙는다", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      target: "20대",
      hooks: ["number", "story", "trust"],
    });
    expect(prompt).toContain("본문1 — Number 훅");
    expect(prompt).toContain("본문2 — Story 훅");
    expect(prompt).toContain("본문3 — Trust 훅");
  });

  it("hooks 가 2개뿐이면(잘못된 입력) 추천 풀로 폴백한다", () => {
    const prompt = buildCreativePrompt({
      ...BASE,
      target: "20대",
      hooks: ["story"],
    });
    expect(prompt).toContain("본문1 = Number"); // traffic 추천 풀
  });
});

describe("parseImageConcepts — Image Concept 3개 검증 (ADR-040)", () => {
  const valid = JSON.stringify({
    concepts: [
      { label: "스튜디오 · 클로즈업", prompt: "studio close-up, pastel" },
      { label: "야외 · 와이드", prompt: "outdoor wide shot, morning light" },
      { label: "플랫레이 · 탑다운", prompt: "flat lay, top-down, minimal" },
    ],
  });

  it("유효한 concept 3개를 그대로 반환한다", () => {
    const { concepts } = parseImageConcepts(valid);
    expect(concepts).toHaveLength(3);
    expect(concepts.every((c) => c.label && c.prompt)).toBe(true);
  });

  it("JSON 파싱 실패 시 throw", () => {
    expect(() => parseImageConcepts("not json")).toThrow();
  });

  it("label·prompt 둘 다 있는 게 3개 미만이면 throw", () => {
    const text = JSON.stringify({
      concepts: [
        { label: "a", prompt: "p1" },
        { label: "b" }, // prompt 누락 → 탈락
        { label: "c", prompt: "p3" },
      ],
    });
    expect(() => parseImageConcepts(text)).toThrow();
  });

  it("4개 이상이면 앞 3개로 자른다", () => {
    const text = JSON.stringify({
      concepts: [
        { label: "1", prompt: "p1" },
        { label: "2", prompt: "p2" },
        { label: "3", prompt: "p3" },
        { label: "4", prompt: "p4" },
      ],
    });
    expect(parseImageConcepts(text).concepts).toHaveLength(3);
  });

  it("label 의 한자는 제거된다", () => {
    const text = JSON.stringify({
      concepts: [
        { label: "스튜디오寫真", prompt: "p1" },
        { label: "b", prompt: "p2" },
        { label: "c", prompt: "p3" },
      ],
    });
    expect(parseImageConcepts(text).concepts[0].label).toBe("스튜디오");
  });

  it("overlayHeadlines 를 최대 3개까지 파싱한다", () => {
    const text = JSON.stringify({
      concepts: [
        { label: "1", prompt: "p1" },
        { label: "2", prompt: "p2" },
        { label: "3", prompt: "p3" },
      ],
      overlayHeadlines: ["피부가 먼저", "오늘부터 달라져요", "지금 시작", "넷째는 잘림"],
    });
    expect(parseImageConcepts(text).overlayHeadlines).toEqual([
      "피부가 먼저",
      "오늘부터 달라져요",
      "지금 시작",
    ]);
  });

  it("overlayHeadlines 누락 시 빈 배열", () => {
    const text = JSON.stringify({
      concepts: [
        { label: "1", prompt: "p1" },
        { label: "2", prompt: "p2" },
        { label: "3", prompt: "p3" },
      ],
    });
    expect(parseImageConcepts(text).overlayHeadlines).toEqual([]);
  });
});

describe("filterOverlayHeadlines — ADR-031 표제 수치 가드", () => {
  it("source 에 없는 수치를 든 표제는 탈락한다", () => {
    const out = filterOverlayHeadlines(
      ["재구매율 73%", "피부가 먼저"],
      "오늘부터 달라지는 피부",
    );
    expect(out).toEqual(["피부가 먼저"]);
  });

  it("source 에 있는 수치를 인용한 표제는 통과한다", () => {
    const out = filterOverlayHeadlines(
      ["재구매율 73%", "지금 시작"],
      "재구매율 73% 검증된 그린루틴",
    );
    expect(out).toEqual(["재구매율 73%", "지금 시작"]);
  });

  it("수치 없는 표제는 항상 통과한다", () => {
    expect(filterOverlayHeadlines(["피부가 먼저", "오늘부터"], "숫자 없는 원문")).toEqual([
      "피부가 먼저",
      "오늘부터",
    ]);
  });
});
