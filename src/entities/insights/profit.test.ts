import { describe, it, expect } from "vitest";
import { contributionMargin, bepRoas } from "./profit";

describe("contributionMargin", () => {
  it("마진율이 null 이면 계산을 거부하고 null", () => {
    expect(contributionMargin(1_000_000, 300_000, null)).toBeNull();
  });

  it("흑자: 전환매출 × 마진율 − 광고비", () => {
    expect(contributionMargin(1_000_000, 200_000, 0.3)).toBe(100_000);
  });

  it("적자: 마진이 광고비를 못 덮으면 음수", () => {
    expect(contributionMargin(1_000_000, 200_000, 0.15)).toBe(-50_000);
  });

  it("마진율 0 이면 광고비만큼 손실", () => {
    expect(contributionMargin(1_000_000, 200_000, 0)).toBe(-200_000);
  });
});

describe("bepRoas", () => {
  it("마진율이 null 이면 null", () => {
    expect(bepRoas(null)).toBeNull();
  });

  it("마진율 0 이면 손익분기 정의 불가 → null", () => {
    expect(bepRoas(0)).toBeNull();
  });

  it("1 / 마진율 (소수 2자리)", () => {
    expect(bepRoas(0.3)).toBe(3.33);
    expect(bepRoas(0.5)).toBe(2);
  });
});
