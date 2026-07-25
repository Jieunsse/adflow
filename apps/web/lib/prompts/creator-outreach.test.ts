import { describe, expect, it } from "vitest";
import { parseOutreach } from "./creator-outreach";

describe("parseOutreach", () => {
  it("message 필드를 그대로 반환", () => {
    const result = parseOutreach(JSON.stringify({ message: "안녕하세요, 협업 제안드려요." }));
    expect(result.message).toBe("안녕하세요, 협업 제안드려요.");
  });

  it("message 없으면 throw", () => {
    expect(() => parseOutreach(JSON.stringify({}))).toThrow();
  });

  it("JSON 파싱 실패 시 throw", () => {
    expect(() => parseOutreach("not json")).toThrow();
  });
});
