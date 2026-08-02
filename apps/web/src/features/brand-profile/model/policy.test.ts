import { describe, expect, it } from "vitest";
import { replacePolicySection } from "./policy";

describe("replacePolicySection", () => {
  it("같은 유형의 정책은 새 값으로 교체한다", () => {
    const policy = [{ type: "prohibited_words" as const, data: { words: ["최저가"] } }];

    expect(replacePolicySection(policy, { type: "prohibited_words", data: { words: ["무조건"] } })).toEqual([
      { type: "prohibited_words", data: { words: ["무조건"] } },
    ]);
  });

  it("비어 있는 정책을 저장하면 해당 유형을 제거한다", () => {
    const policy = [{ type: "required_phrases" as const, data: { phrases: ["비건 인증"] } }];

    expect(replacePolicySection(policy, { type: "required_phrases", data: { phrases: [] } })).toEqual([]);
  });
});
