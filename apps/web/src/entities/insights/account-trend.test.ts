import { describe, it, expect } from "vitest";
import { mergeAccountDaily, pickPerfAxis, deriveFunnel, synthAccountDaily, deriveEfficiency, deriveTrendMetrics, perfLineLabel, trendSubtitle } from "./account-trend";
import type { AccountDailyPoint, PerfAxis } from "./account-trend";
import type { InsightsDailyRow } from "./types";

const row = (date: string, p: Partial<InsightsDailyRow>): InsightsDailyRow => ({
  date,
  clicks: 0,
  ctr: 0,
  spend: 0,
  ...p,
});

describe("mergeAccountDaily", () => {
  it("같은 날짜를 합산하고 날짜순 정렬한다", () => {
    const a = [row("2026-06-02", { spend: 100, clicks: 5, impressions: 1000 })];
    const b = [
      row("2026-06-01", { spend: 50, clicks: 2, impressions: 400 }),
      row("2026-06-02", { spend: 30, clicks: 1, impressions: 200 }),
    ];
    const merged = mergeAccountDaily([a, b]);
    expect(merged.map((d) => d.date)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(merged[1]).toMatchObject({ spend: 130, clicks: 6, impressions: 1200 });
  });

  it("누락 필드는 0 기여", () => {
    const merged = mergeAccountDaily([[row("2026-06-01", { spend: 10 })]]);
    expect(merged[0]).toMatchObject({ landingPageView: 0, purchaseValue: 0, clicks: 0 });
  });

  it("빈 입력은 빈 배열", () => {
    expect(mergeAccountDaily([])).toEqual([]);
    expect(mergeAccountDaily([[]])).toEqual([]);
  });
});

describe("pickPerfAxis", () => {
  const daily = [
    { date: "d1", spend: 10, impressions: 100, clicks: 5, landingPageView: 3, purchaseValue: 0 },
    { date: "d2", spend: 20, impressions: 200, clicks: 8, landingPageView: 4, purchaseValue: 500 },
  ];

  it("전환 캠페인 ≥1 이면 매출축", () => {
    const axis = pickPerfAxis(daily, 1);
    expect(axis.metric).toBe("revenue");
    expect(axis.label).toBe("매출");
    expect(axis.values).toEqual([0, 500]);
    expect(axis.hasData).toBe(true);
  });

  it("전환 0 + 도착 있으면 도착축", () => {
    const axis = pickPerfAxis(daily, 0);
    expect(axis.metric).toBe("landing");
    expect(axis.values).toEqual([3, 4]);
  });

  it("전환 0 + 도착 0 이면 클릭 폴백", () => {
    const noLanding = daily.map((d) => ({ ...d, landingPageView: 0 }));
    const axis = pickPerfAxis(noLanding, 0);
    expect(axis.metric).toBe("clicks");
    expect(axis.values).toEqual([5, 8]);
  });

  it("전환 캠페인 있으나 매출 0 이면 매출축 + hasData=false (티저)", () => {
    const noRevenue = daily.map((d) => ({ ...d, purchaseValue: 0 }));
    const axis = pickPerfAxis(noRevenue, 2);
    expect(axis.metric).toBe("revenue");
    expect(axis.hasData).toBe(false);
  });
});

describe("synthAccountDaily", () => {
  const camps = [
    { id: "a", impressions: 1400, clicks: 140, spend: 14000, landingPageView: 70 },
    { id: "b", impressions: 700, clicks: 28, spend: 7000 },
  ];

  it("windowDays 만큼 날짜를 만들고 마지막이 today", () => {
    const out = synthAccountDaily(camps, "2026-06-03", 14);
    expect(out).toHaveLength(14);
    expect(out[out.length - 1].date).toBe("2026-06-03");
  });

  it("합산이 totals 에 근사(분산해도 보존)", () => {
    const out = synthAccountDaily(camps, "2026-06-03", 14);
    const sumSpend = out.reduce((s, d) => s + d.spend, 0);
    const sumLanding = out.reduce((s, d) => s + d.landingPageView, 0);
    expect(sumSpend).toBeGreaterThan(20000 * 0.97);
    expect(sumSpend).toBeLessThan(21000 * 1.03);
    expect(sumLanding).toBeGreaterThan(68);
    expect(sumLanding).toBeLessThan(72);
  });

  it("결정적 — 같은 입력 같은 출력", () => {
    expect(synthAccountDaily(camps, "2026-06-03", 14)).toEqual(synthAccountDaily(camps, "2026-06-03", 14));
  });

  it("favorable — 지출·도착 모두 우상향(도착이 더 가파름, 호조 서사)", () => {
    const out = synthAccountDaily(camps, "2026-06-03", 14, true);
    const half = Math.floor(out.length / 2);
    const spendEarly = out.slice(0, half).reduce((s, d) => s + d.spend, 0);
    const spendLate = out.slice(half).reduce((s, d) => s + d.spend, 0);
    const landEarly = out.slice(0, half).reduce((s, d) => s + d.landingPageView, 0);
    const landLate = out.slice(half).reduce((s, d) => s + d.landingPageView, 0);
    expect(spendLate).toBeGreaterThan(spendEarly);
    expect(landLate).toBeGreaterThan(landEarly);
  });

  it("favorable=false 는 균등(기본) — totals 보존 동일", () => {
    expect(synthAccountDaily(camps, "2026-06-03", 14, false)).toEqual(synthAccountDaily(camps, "2026-06-03", 14));
  });
});

const axis = (values: number[]): PerfAxis => ({ metric: "landing", label: "도착", values, hasData: values.some((v) => v > 0) });
const pt = (date: string, spend: number, landing: number): AccountDailyPoint => ({ date, spend, impressions: 0, clicks: 0, landingPageView: landing, purchaseValue: 0 });

describe("deriveEfficiency", () => {
  it("효율 = 성과/지출, spend=0 인 날은 null", () => {
    const daily = [pt("d1", 10, 50), pt("d2", 0, 0), pt("d3", 20, 60)];
    expect(deriveEfficiency(daily, axis([50, 0, 60]))).toEqual([5, null, 3]);
  });
});

describe("perfLineLabel", () => {
  it("매출축 → ROAS 라벨", () => {
    expect(perfLineLabel({ metric: "revenue", label: "매출", values: [1], hasData: true })).toBe("ROAS(광고비 대비 매출)");
  });
  it("도착축 → 1천원당 도착", () => {
    expect(perfLineLabel({ metric: "landing", label: "도착", values: [1], hasData: true })).toContain("도착 수");
  });
  it("클릭축 → 1천원당 클릭", () => {
    expect(perfLineLabel({ metric: "clicks", label: "클릭", values: [1], hasData: true })).toContain("클릭 수");
  });
});

describe("trendSubtitle", () => {
  it("diverge 부제에 처방 절 없음(진단 전용)", () => {
    const s = trendSubtitle("diverge", axis([1]));
    expect(s).toBe("돈은 더 쓰는데 도착은 제자리예요.");
    expect(s).not.toContain("점검");
    expect(s).not.toContain("—");
  });
  it("co-rise/co-fall/stable/insufficient 분기 카피", () => {
    expect(trendSubtitle("co-rise", axis([1]))).toContain("따라오고");
    expect(trendSubtitle("co-fall", axis([1]))).toContain("함께 줄고");
    expect(trendSubtitle("stable", axis([1]))).toContain("안정적");
    expect(trendSubtitle("insufficient", axis([1]))).toContain("조금 더 필요");
  });
});

describe("deriveTrendMetrics", () => {
  it("발산(지출↑ 효율↓) → diverge + divergeRange 산출", () => {
    const daily = [pt("d1", 10, 50), pt("d2", 12, 50), pt("d3", 30, 50), pt("d4", 40, 50)];
    const m = deriveTrendMetrics(daily, axis([50, 50, 50, 50]));
    expect(m.verdict).toBe("diverge");
    expect(m.divergeRange).toBeDefined();
    expect(m.divergeRange![1]).toBe(3);
    expect(m.earlyAvg).toBeGreaterThan(m.lateAvg);
  });

  it("수렴(지출↑ 효율 유지/상승) → co-rise · divergeRange 없음", () => {
    const daily = [pt("d1", 10, 10), pt("d2", 12, 12), pt("d3", 30, 30), pt("d4", 40, 40)];
    const m = deriveTrendMetrics(daily, axis([10, 12, 30, 40]));
    expect(m.verdict).toBe("co-rise");
    expect(m.divergeRange).toBeUndefined();
  });

  it("지출↓ → co-fall", () => {
    const daily = [pt("d1", 40, 40), pt("d2", 38, 38), pt("d3", 12, 12), pt("d4", 10, 10)];
    expect(deriveTrendMetrics(daily, axis([40, 38, 12, 10])).verdict).toBe("co-fall");
  });

  it("지출·효율 평탄 → stable", () => {
    const daily = [pt("d1", 20, 40), pt("d2", 20, 40), pt("d3", 21, 42), pt("d4", 20, 40)];
    expect(deriveTrendMetrics(daily, axis([40, 40, 42, 40])).verdict).toBe("stable");
  });

  it("데이터 부족(<4일) → insufficient", () => {
    const daily = [pt("d1", 10, 5), pt("d2", 20, 6)];
    expect(deriveTrendMetrics(daily, axis([5, 6])).verdict).toBe("insufficient");
  });

  it("성과 hasData=false → insufficient", () => {
    const daily = [pt("d1", 10, 0), pt("d2", 20, 0), pt("d3", 30, 0), pt("d4", 40, 0)];
    expect(deriveTrendMetrics(daily, axis([0, 0, 0, 0])).verdict).toBe("insufficient");
  });
});

describe("deriveFunnel", () => {
  it("노출 분모 고정 + 단별 전환율", () => {
    const { stages, hasData } = deriveFunnel([
      { impressions: 1000, clicks: 100, landingPageView: 60, purchaseCount: 6 },
    ]);
    expect(hasData).toBe(true);
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
    expect(byKey.clicks.stepRate).toBeCloseTo(0.1); // 100/1000
    expect(byKey.clicks.pctOfImpressions).toBeCloseTo(0.1);
    expect(byKey.landing.stepRate).toBeCloseTo(0.6); // 60/100
    expect(byKey.purchase.stepRate).toBeCloseTo(0.1); // 6/60 (도착 기준)
  });

  it("도착 미측정 캠페인은 도착 단 measured=false", () => {
    const { stages } = deriveFunnel([{ impressions: 1000, clicks: 100 }]);
    const landing = stages.find((s) => s.key === "landing")!;
    expect(landing.measured).toBe(false);
    expect(landing.stepRate).toBeNull();
    expect(landing.denomLabel).toBeNull();
  });

  it("부분 측정 — 도착 분모는 측정된 캠페인의 클릭만", () => {
    const { stages } = deriveFunnel([
      { impressions: 500, clicks: 50, landingPageView: 30 }, // 측정
      { impressions: 500, clicks: 50 }, // 미측정
    ]);
    const landing = stages.find((s) => s.key === "landing")!;
    expect(landing.value).toBe(30);
    expect(landing.stepRate).toBeCloseTo(0.6); // 30/50 (측정 캠페인 클릭만)
    expect(landing.denomLabel).toContain("도착 측정 1개");
  });

  it("드롭 큰 단(전환율 <0.5)에 bigDrop", () => {
    const { stages } = deriveFunnel([
      { impressions: 1000, clicks: 100, landingPageView: 30 }, // 도착 0.3 < 0.5
    ]);
    expect(stages.find((s) => s.key === "clicks")!.bigDrop).toBe(true); // 0.1
    expect(stages.find((s) => s.key === "landing")!.bigDrop).toBe(true); // 0.3
  });

  it("노출 0 이면 hasData=false", () => {
    const { hasData } = deriveFunnel([]);
    expect(hasData).toBe(false);
  });
});
