import { describe, expect, it } from "vitest";
import {
  COPY_HOOKS,
  recommendedHooks,
  findHook,
  OBJECTIVES_PHASE1,
  type CopyHook,
} from "./options";

describe("Copy Hook — 추천 풀 (ADR-029)", () => {
  it("BTNARUST 8종이 모두 정의돼 있다", () => {
    const ids = COPY_HOOKS.map((h) => h.id).sort();
    expect(ids).toEqual(
      (["benefit", "number", "rush", "story", "surprise", "trendy", "trust", "unique"] as CopyHook[]).sort(),
    );
  });

  it("Phase 1 모든 Outcome 칩이 정확히 3훅으로 해소된다", () => {
    for (const o of OBJECTIVES_PHASE1) {
      const hooks = recommendedHooks(o.id);
      expect(hooks).toHaveLength(3);
      expect(new Set(hooks).size).toBe(3); // 중복 없음
    }
  });

  it("grill 매핑: 인지도=Surprise·Story·Unique / 참여=Trendy·Story·Surprise / 트래픽=Number·Trust·Benefit", () => {
    expect(recommendedHooks("awareness")).toEqual(["surprise", "story", "unique"]);
    expect(recommendedHooks("engagement")).toEqual(["trendy", "story", "surprise"]);
    expect(recommendedHooks("traffic")).toEqual(["number", "trust", "benefit"]);
  });

  it("Rush 는 어떤 기본 추천 풀에도 없다 (디테일 모드 전용)", () => {
    for (const o of OBJECTIVES_PHASE1) {
      expect(recommendedHooks(o.id)).not.toContain("rush");
    }
  });

  it("findHook 은 라벨·한국어·프롬프트 설명을 준다", () => {
    expect(findHook("number").label).toBe("Number");
    expect(findHook("number").ko).toBe("수치");
    expect(findHook("number").promptDesc).toContain("수치");
  });
});
