import { describe, expect, it } from "vitest";
import { parseGuideline } from "./creator-content-guideline";

const VALID = {
  mustInclude: ["제품 클로즈업"],
  tone: "밝고 경쾌한 톤",
  dosDonts: ["자연광에서 촬영하세요"],
  caption: "오늘의 픽!",
};

describe("parseGuideline", () => {
  it("모든 필드가 있으면 그대로 반환", () => {
    const result = parseGuideline(JSON.stringify(VALID));
    expect(result).toEqual(VALID);
  });

  it("mustInclude 가 빈 배열이면 throw", () => {
    expect(() => parseGuideline(JSON.stringify({ ...VALID, mustInclude: [] }))).toThrow();
  });

  it("caption 이 빈 문자열이면 throw", () => {
    expect(() => parseGuideline(JSON.stringify({ ...VALID, caption: "" }))).toThrow();
  });

  it("JSON 파싱 실패 시 throw", () => {
    expect(() => parseGuideline("not json")).toThrow();
  });
});
