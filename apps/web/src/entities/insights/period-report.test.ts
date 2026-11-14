import { describe, expect, it } from "vitest";
import { buildPeriodReport, deltaPct, reportRanges } from "./period-report";

const point = (date: string, spend: number, extra: Partial<{ impressions: number; clicks: number; lpv: number; revenue: number; purchases: number }> = {}) => ({
  date,
  spend,
  impressions: extra.impressions ?? 0,
  clicks: extra.clicks ?? 0,
  landingPageView: extra.lpv ?? 0,
  purchaseValue: extra.revenue ?? 0,
  purchaseCount: extra.purchases ?? 0,
});

describe("reportRanges", () => {
  it("주간은 지난 월요일부터 일요일까지예요", () => {
    // 2026-11-14 는 토요일
    expect(reportRanges("weekly", "2026-11-14")).toEqual({
      current: { start: "2026-11-02", end: "2026-11-08" },
      previous: { start: "2026-10-26", end: "2026-11-01" },
    });
    // 월요일 당일에도 지난주를 본다
    expect(reportRanges("weekly", "2026-11-09").current).toEqual({ start: "2026-11-02", end: "2026-11-08" });
  });

  it("월간은 지난 달력 한 달이고 연도를 넘어가요", () => {
    expect(reportRanges("monthly", "2026-01-15")).toEqual({
      current: { start: "2025-12-01", end: "2025-12-31" },
      previous: { start: "2025-11-01", end: "2025-11-30" },
    });
  });
});

describe("buildPeriodReport", () => {
  const ranges = { current: { start: "2026-11-02", end: "2026-11-08" }, previous: { start: "2026-10-26", end: "2026-11-01" } };
  const daily = [
    point("2026-10-30", 100_000, { revenue: 200_000, purchases: 4, lpv: 100 }),
    point("2026-11-03", 200_000, { impressions: 10_000, clicks: 150, lpv: 120, revenue: 600_000, purchases: 6 }),
    point("2026-11-10", 999_999), // 기간 밖
  ];

  it("정책서 8.2 계산식으로 기간 지표와 지난 기간을 함께 준다", () => {
    const m = Object.fromEntries(buildPeriodReport(daily, ranges, 0.4).map((x) => [x.key, x]));
    expect(m.spend.value).toBe(200_000);
    expect(m.spend.previous).toBe(100_000);
    expect(m.ctr.value).toBeCloseTo(1.5);
    expect(m.roas.value).toBe(3);
    expect(m.aov.value).toBe(100_000); // 매출 ÷ 구매 수
    expect(m.cvr.value).toBeCloseTo(5); // 구매 ÷ 랜딩 조회
    expect(m.contribution.value).toBe(40_000); // 60만 × 0.4 − 20만
    expect(m.bepRoas.value).toBe(2.5);
    expect(deltaPct(m.spend)).toBe(100);
  });

  it("나눌 수 없으면 값이 없고 마진율이 없으면 손익 지표를 빼요", () => {
    const m = Object.fromEntries(buildPeriodReport([point("2026-11-03", 10_000)], ranges).map((x) => [x.key, x]));
    expect(m.aov.value).toBeNull();
    expect(m.contribution).toBeUndefined();
    expect(deltaPct(m.spend)).toBeNull();
  });
});
