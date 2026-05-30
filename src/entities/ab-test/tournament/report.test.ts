import { describe, expect, it } from "vitest";
import { buildRoundReport, COMPLETED_CONFIDENCE } from "./report";
import type { AdKpi } from "@entities/insights/ab-verdict";

// ADR-032/033 — Browse Mode Round Report. 순수 파생 함수 회귀 안전망.

const ctx = { seed: "browse_tourn_x_r1", dailyBudget: 30000, days: 7 };

describe("buildRoundReport — 확장 지표 파생", () => {
  it("동일 입력 → 동일 출력 (결정적)", () => {
    const a: AdKpi = { ctr: 1.8, impressions: 15400, clicks: 277, spend: 227000 };
    const b: AdKpi = { ctr: 2.4, impressions: 15200, clicks: 365, spend: 299000 };
    expect(buildRoundReport([a, b], ctx)).toEqual(buildRoundReport([a, b], ctx));
  });

  it("도달 ≤ 노출 (빈도 ≥ 1), 링크클릭 ≤ 클릭", () => {
    const a: AdKpi = { ctr: 1.8, impressions: 15400, clicks: 277, spend: 227000 };
    const b: AdKpi = { ctr: 2.4, impressions: 15200, clicks: 365, spend: 299000 };
    const { ads } = buildRoundReport([a, b], ctx);
    for (const [i, ad] of ads.entries()) {
      const src = i === 0 ? a : b;
      expect(ad.reach).toBeLessThanOrEqual(src.impressions);
      expect(ad.frequency).toBeGreaterThanOrEqual(1);
      expect(ad.linkClicks).toBeLessThanOrEqual(src.clicks);
    }
  });

  it("cpm·cpc 정확식, budgetRemaining 음수 없음", () => {
    const a: AdKpi = { ctr: 1.8, impressions: 15400, clicks: 277, spend: 227000 };
    const b: AdKpi = { ctr: 2.4, impressions: 15200, clicks: 365, spend: 299000 };
    const { ads } = buildRoundReport([a, b], ctx);
    expect(ads[0].cpm).toBe(Math.round((a.spend / a.impressions) * 1000));
    expect(ads[0].cpc).toBe(Math.round(a.spend / a.clicks));
    expect(ads[0].budgetRemaining).toBeGreaterThanOrEqual(0);
  });
});

describe("buildRoundReport — confidence/status (z-검정)", () => {
  it("CTR 동일 → 신뢰도 ≈ 0.5, INCONCLUSIVE", () => {
    const a: AdKpi = { ctr: 1.8, impressions: 15000, clicks: 270, spend: 200000 };
    const b: AdKpi = { ctr: 1.8, impressions: 15000, clicks: 270, spend: 200000 };
    const r = buildRoundReport([a, b], ctx);
    expect(r.confidenceLevel).toBeCloseTo(0.5, 2);
    expect(r.status).toBe("INCONCLUSIVE");
  });

  it("큰 표본 + 뚜렷한 CTR 차이 → 높은 신뢰도, COMPLETED", () => {
    const a: AdKpi = { ctr: 1.5, impressions: 15000, clicks: 225, spend: 200000 };
    const b: AdKpi = { ctr: 2.5, impressions: 15000, clicks: 375, spend: 300000 };
    const r = buildRoundReport([a, b], ctx);
    expect(r.confidenceLevel).toBeGreaterThanOrEqual(COMPLETED_CONFIDENCE);
    expect(r.status).toBe("COMPLETED");
  });

  it("작은 표본은 같은 CTR 차이라도 신뢰도가 낮다", () => {
    const small = buildRoundReport(
      [
        { ctr: 1.5, impressions: 400, clicks: 6, spend: 5000 },
        { ctr: 2.5, impressions: 400, clicks: 10, spend: 8000 },
      ],
      ctx,
    );
    const large = buildRoundReport(
      [
        { ctr: 1.5, impressions: 15000, clicks: 225, spend: 200000 },
        { ctr: 2.5, impressions: 15000, clicks: 375, spend: 300000 },
      ],
      ctx,
    );
    expect(small.confidenceLevel).toBeLessThan(large.confidenceLevel);
  });

  it("데이터 없음(노출 0) → 신뢰도 0.5, INCONCLUSIVE, 지표 0", () => {
    const zero: AdKpi = { ctr: 0, impressions: 0, clicks: 0, spend: 0 };
    const r = buildRoundReport([zero, zero], ctx);
    expect(r.status).toBe("INCONCLUSIVE");
    expect(r.ads[0].reach).toBe(0);
    expect(r.ads[0].cpm).toBe(0);
  });
});
