import { describe, expect, it } from "vitest";
import { AB_VERDICT_THRESHOLDS, judgeAbTest, type AdKpi } from "./ab-verdict";

// PRD-ab-testing.md §6.5 — 외부 인터페이스 = pure 함수. ADR-002 외부 인터페이스 룰 정렬.

const ok: AdKpi = { ctr: 1.2, impressions: 20000, clicks: 240, spend: 50000 };

describe("judgeAbTest — insufficient 단계", () => {
  it("두 광고 모두 노출 < 1000 → insufficient(impressions)", () => {
    const a: AdKpi = { ctr: 1, impressions: 500, clicks: 5, spend: 10000 };
    const b: AdKpi = { ctr: 1.1, impressions: 600, clicks: 6, spend: 11000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("insufficient");
    if (v.state === "insufficient") {
      expect(v.reason).toBe("impressions");
      expect(v.thresholds.impressions).toBe(AB_VERDICT_THRESHOLDS.minImpressionsPerAd);
    }
  });

  it("한쪽만 노출 < 1000 → insufficient(impressions)", () => {
    const a: AdKpi = { ctr: 1, impressions: 800, clicks: 9, spend: 10000 };
    const b: AdKpi = { ctr: 1.2, impressions: 2000, clicks: 24, spend: 20000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("insufficient");
    if (v.state === "insufficient") expect(v.reason).toBe("impressions");
  });

  it("노출은 충분, 한쪽 클릭 < 10 → insufficient(clicks)", () => {
    const a: AdKpi = { ctr: 0.5, impressions: 1200, clicks: 6, spend: 12000 };
    const b: AdKpi = { ctr: 1.0, impressions: 1500, clicks: 15, spend: 15000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("insufficient");
    if (v.state === "insufficient") expect(v.reason).toBe("clicks");
  });

  it("노출 = 정확히 1000 → 통과 (≥ 비교, 미만만 차단)", () => {
    const a: AdKpi = { ctr: 1.0, impressions: 1000, clicks: 10, spend: 20000 };
    const b: AdKpi = { ctr: 1.0, impressions: 1000, clicks: 10, spend: 20000 };
    const v = judgeAbTest(a, b);
    // 노출·클릭 임계 통과, CTR ratio = 1.0 < 1.2 → inconclusive
    expect(v.state).toBe("inconclusive");
  });
});

describe("judgeAbTest — inconclusive 단계", () => {
  it("CTR ratio = 1.0 → inconclusive", () => {
    const v = judgeAbTest(ok, ok);
    expect(v.state).toBe("inconclusive");
  });

  it("CTR ratio = 1.1 → inconclusive (1.2 미만)", () => {
    const a: AdKpi = { ctr: 1.0, impressions: 20000, clicks: 200, spend: 50000 };
    const b: AdKpi = { ctr: 1.1, impressions: 20000, clicks: 220, spend: 50000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("inconclusive");
  });
});

describe("judgeAbTest — winner 단계", () => {
  it("CTR ratio = 정확히 1.2 → winner (경계 포함)", () => {
    const a: AdKpi = { ctr: 1.0, impressions: 20000, clicks: 200, spend: 50000 };
    const b: AdKpi = { ctr: 1.2, impressions: 20000, clicks: 240, spend: 50000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("winner");
    if (v.state === "winner") {
      expect(v.winner).toBe("B");
      expect(v.ratio).toBeCloseTo(1.2, 5);
    }
  });

  it("B 우세 1.5배 → winner=B, ratio ≈ 1.5", () => {
    const a: AdKpi = { ctr: 1.0, impressions: 20000, clicks: 200, spend: 50000 };
    const b: AdKpi = { ctr: 1.5, impressions: 20000, clicks: 300, spend: 50000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("winner");
    if (v.state === "winner") {
      expect(v.winner).toBe("B");
      expect(v.ratio).toBeCloseTo(1.5, 5);
    }
  });

  it("A 우세 2배 → winner=A, ratio ≈ 2.0", () => {
    const a: AdKpi = { ctr: 2.0, impressions: 20000, clicks: 400, spend: 50000 };
    const b: AdKpi = { ctr: 1.0, impressions: 20000, clicks: 200, spend: 50000 };
    const v = judgeAbTest(a, b);
    expect(v.state).toBe("winner");
    if (v.state === "winner") {
      expect(v.winner).toBe("A");
      expect(v.ratio).toBeCloseTo(2.0, 5);
    }
  });

  it("CTR 같음 → inconclusive (winner 분기 안 탐, 동률은 A 명목 winner 라도 ratio 1.0)", () => {
    const v = judgeAbTest(ok, ok);
    expect(v.state).toBe("inconclusive");
  });
});
