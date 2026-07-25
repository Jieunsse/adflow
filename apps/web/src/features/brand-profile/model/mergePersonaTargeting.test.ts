import { describe, expect, it } from "vitest";
import { mergePersonaTargeting } from "./mergePersonaTargeting";

const ai = { ageMin: 25, ageMax: 45, genders: [2] };

describe("mergePersonaTargeting", () => {
  it("페르소나 없으면 AI 추천 그대로 + 모든 출처 ai", () => {
    expect(mergePersonaTargeting(ai)).toEqual({
      targeting: ai,
      source: { age: "ai", gender: "ai" },
    });
  });

  it("연령·성별 비우면(undefined) AI 추천 사용", () => {
    const r = mergePersonaTargeting(ai, { ageMin: undefined, ageMax: undefined, genders: undefined });
    expect(r.targeting).toEqual(ai);
    expect(r.source).toEqual({ age: "ai", gender: "ai" });
  });

  it("연령 명시 시 override, 성별은 그대로 AI", () => {
    const r = mergePersonaTargeting(ai, { ageMin: 30, ageMax: 39, genders: undefined });
    expect(r.targeting).toEqual({ ageMin: 30, ageMax: 39, genders: [2] });
    expect(r.source).toEqual({ age: "persona", gender: "ai" });
  });

  it("genders:[] 는 전체 명시 override", () => {
    const r = mergePersonaTargeting(ai, { ageMin: undefined, ageMax: undefined, genders: [] });
    expect(r.targeting).toEqual({ ageMin: 25, ageMax: 45, genders: [] });
    expect(r.source).toEqual({ age: "ai", gender: "persona" });
  });

  it("성별 [1] override", () => {
    const r = mergePersonaTargeting(ai, { genders: [1] });
    expect(r.targeting.genders).toEqual([1]);
    expect(r.source.gender).toBe("persona");
  });

  it("연령 한쪽만 정의되면 override 아님(쌍으로만 override)", () => {
    const r = mergePersonaTargeting(ai, { ageMin: 30, ageMax: undefined });
    expect(r.targeting.ageMin).toBe(25);
    expect(r.source.age).toBe("ai");
  });
});
