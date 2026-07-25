import { describe, expect, it } from "vitest";
import { nextStepAfterBrief, shouldTriggerGenerate, isBriefDone, isStudioDone } from "./brief-flow";

// 회귀 안전망 — PRD-create-flow-redesign §3 브리프 진행·게이트 판정.

describe("nextStepAfterBrief", () => {
  it("boost_post 는 스튜디오(1)를 건너뛰고 게재(2)로 직행", () => {
    expect(nextStepAfterBrief("boost_post")).toBe(2);
  });

  it("boost 아닌 목표는 스튜디오(1)로 진입", () => {
    expect(nextStepAfterBrief("traffic")).toBe(1);
  });
});

describe("shouldTriggerGenerate", () => {
  it("생성 결과가 없으면 트리거", () => {
    expect(shouldTriggerGenerate(false, null, "traffic")).toBe(true);
  });

  it("생성 결과가 있고 같은 outcome 이면 재생성 안 함", () => {
    expect(shouldTriggerGenerate(true, "traffic", "traffic")).toBe(false);
  });

  it("생성 결과가 있어도 outcome 이 바뀌었으면 재생성", () => {
    expect(shouldTriggerGenerate(true, "traffic", "awareness")).toBe(true);
  });
});

describe("isBriefDone", () => {
  it("목표 미선택 시 false — 01→02 게이트 차단", () => {
    expect(isBriefDone(null)).toBe(false);
  });

  it("목표 선택 시 true", () => {
    expect(isBriefDone("awareness")).toBe(true);
  });
});

describe("isStudioDone", () => {
  it("boost_post 는 헤드라인·이미지 없어도 항상 true", () => {
    expect(isStudioDone("boost_post", false, false)).toBe(true);
  });

  it("boost 아닌 목표는 헤드라인+이미지 모두 있어야 true", () => {
    expect(isStudioDone("traffic", true, true)).toBe(true);
    expect(isStudioDone("traffic", true, false)).toBe(false);
    expect(isStudioDone("traffic", false, true)).toBe(false);
  });
});
