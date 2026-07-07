import { describe, it, expect } from "vitest";
import { calcDaysBetween, estimateImpressionRange } from "./budget-estimates";

describe("estimateImpressionRange", () => {
  it("일 50,000원 × 8일 → CPM 3,000~8,000원 환산", () => {
    expect(estimateImpressionRange(50_000, 8)).toEqual({ min: 50_000, max: 133_300 });
  });

  it("일 10,000원 × 1일 → 총 예산 10,000원", () => {
    expect(estimateImpressionRange(10_000, 1)).toEqual({ min: 1_300, max: 3_300 });
  });

  it("예산 0이면 노출도 0", () => {
    expect(estimateImpressionRange(0, 7)).toEqual({ min: 0, max: 0 });
  });
});

describe("calcDaysBetween", () => {
  it("시작일과 종료일이 같으면 1일", () => {
    expect(calcDaysBetween("2026-07-04", "2026-07-04")).toBe(1);
  });

  it("잘못된 날짜면 fallback 반환", () => {
    expect(calcDaysBetween("invalid", "2026-07-04", 7)).toBe(7);
  });
});
