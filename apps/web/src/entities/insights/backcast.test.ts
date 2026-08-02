import { describe, it, expect } from "vitest";
import {
  deriveBackcastMap,
  deriveGoalOutlook,
  deriveGoalPace,
  deriveLeadSeries,
  lagTargetOf,
  leadProgressPct,
  liftFactor,
  suggestTargets,
} from "./backcast";

const MEASURED = { ctr: 2.1, cvr: 0.05, aov: 33_000, cpc: 700, cpm: 10_500 };

describe("deriveBackcastMap", () => {
  it("세 지렛대의 목표치를 곱하면 필요한 개선 배수가 정확히 나온다", () => {
    const map = deriveBackcastMap({ metric: "roas", target: 3.0 }, { roas: 2.1 }, MEASURED, null);
    const [ctr, cvr, aov] = map.rows;
    const product = (ctr.target! / ctr.current!) * (cvr.target! / cvr.current!) * (aov.target! / aov.current!);
    expect(product).toBeCloseTo(3.0 / 2.1, 6);
    expect(map.liftPct).toBeCloseTo((3.0 / 2.1 - 1) * 100, 6);
  });

  it("클릭률 목표가 오르면 CPM 이 그대로일 때 클릭당 비용 목표는 내려간다", () => {
    const map = deriveBackcastMap({ metric: "roas", target: 3.0 }, { roas: 2.1 }, MEASURED, null);
    const ctr = map.rows.find((r) => r.kind === "ctr")!;
    const cpc = map.rows.find((r) => r.kind === "cpc")!;
    expect(ctr.target!).toBeGreaterThan(ctr.current!);
    expect(cpc.target!).toBeLessThan(cpc.current!);
    expect(cpc.target!).toBeCloseTo(MEASURED.cpm / (10 * ctr.target!), 6);
  });

  it("CPM 실측이 없으면 클릭률 개선폭으로 클릭당 비용을 근사한다", () => {
    const map = deriveBackcastMap({ metric: "roas", target: 3.0 }, { roas: 2.1 }, { ...MEASURED, cpm: undefined }, null);
    const ctr = map.rows.find((r) => r.kind === "ctr")!;
    const cpc = map.rows.find((r) => r.kind === "cpc")!;
    expect(cpc.target!).toBeCloseTo(MEASURED.cpc * (MEASURED.ctr / ctr.target!), 6);
  });

  it("CPA 목표는 낮을수록 좋다 — 객단가는 지렛대가 아니라 그대로", () => {
    const map = deriveBackcastMap({ metric: "cpa", target: 10_000 }, { cpa: 14_000 }, MEASURED, null);
    const cvr = map.rows.find((r) => r.kind === "cvr")!;
    const aov = map.rows.find((r) => r.kind === "aov")!;
    expect(map.liftPct).toBeCloseTo((14_000 / 10_000 - 1) * 100, 6);
    expect(cvr.target!).toBeGreaterThan(cvr.current!);
    expect(aov.target!).toBeCloseTo(aov.current!, 6);
  });

  it("공헌이익 흑자는 마진율로 만든 손익분기 ROAS 가 목표값", () => {
    const map = deriveBackcastMap({ metric: "contribution", target: 0 }, { roas: 2.1 }, MEASURED, 0.4);
    expect(map.lagTarget).toBeCloseTo(2.5, 6);
  });

  it("실측이 없는 줄은 목표치도 델타도 내지 않는다", () => {
    const map = deriveBackcastMap({ metric: "roas", target: 3.0 }, { roas: 2.1 }, { ctr: 2.1 }, null);
    const aov = map.rows.find((r) => r.kind === "aov")!;
    expect(aov.current).toBeNull();
    expect(aov.target).toBeNull();
    expect(aov.deltaLabel).toBeNull();
  });

  it("후행 목표 실측이 없으면 어떤 줄도 목표치를 못 낸다", () => {
    const map = deriveBackcastMap({ metric: "roas", target: 3.0 }, { roas: null }, MEASURED, null);
    expect(map.liftPct).toBeNull();
    expect(map.rows.every((r) => r.target === null)).toBe(true);
  });
});

describe("liftFactor", () => {
  it("CPA 는 방향이 뒤집힌다 — 지금보다 싸져야 개선", () => {
    expect(liftFactor("cpa", 14_000, 10_000)).toBeCloseTo(1.4, 6);
    expect(liftFactor("roas", 2.1, 3.0)).toBeCloseTo(3.0 / 2.1, 6);
  });

  it("0 이하는 계산을 거부한다", () => {
    expect(liftFactor("roas", 0, 3.0)).toBeNull();
    expect(liftFactor("roas", 2.1, 0)).toBeNull();
  });
});

describe("deriveGoalOutlook", () => {
  it("개선폭이 난이도를 가른다", () => {
    expect(deriveGoalOutlook(15, new Date("2026-08-02")).difficulty).toBe("안정적");
    expect(deriveGoalOutlook(43, new Date("2026-08-02")).difficulty).toBe("도전적");
    expect(deriveGoalOutlook(67, new Date("2026-08-02")).difficulty).toBe("공격적");
  });

  it("주 단위로 올림한 예상 달성일을 낸다", () => {
    const outlook = deriveGoalOutlook(43, new Date("2026-08-02"));
    expect(outlook.weeks).toBe(7);
    expect(outlook.etaDate).toBe("2026-09-20");
  });

  it("실측이 없으면 날짜를 지어내지 않는다", () => {
    expect(deriveGoalOutlook(null, new Date("2026-08-02")).etaDate).toBeNull();
  });
});

describe("suggestTargets", () => {
  it("ROAS 는 올리고 CPA 는 내리는 3구간을 낸다", () => {
    const roas = suggestTargets("roas", 2.1);
    expect(roas.map((s) => s.value)).toEqual([2.5, 3.0, 3.6]);
    const cpa = suggestTargets("cpa", 14_000);
    expect(cpa.every((s) => s.value < 14_000)).toBe(true);
  });

  it("실측이 없으면 추천도 없다", () => {
    expect(suggestTargets("roas", null)).toEqual([]);
  });
});

describe("lagTargetOf", () => {
  it("아직 안 정한 목표값(0)은 목표가 아니다 — 0.0x 를 그리지 않는다", () => {
    expect(lagTargetOf({ metric: "roas", target: 0 }, null)).toBeNull();
    expect(lagTargetOf({ metric: "roas", target: 3 }, null)).toBe(3);
  });

  it("공헌이익 흑자는 마진율이 없으면 목표도 없다", () => {
    expect(lagTargetOf({ metric: "contribution", target: 0 }, null)).toBeNull();
    expect(lagTargetOf({ metric: "contribution", target: 0 }, 0.4)).toBeCloseTo(2.5, 6);
  });
});

describe("deriveLeadSeries", () => {
  const daily = [
    { date: "2026-07-30", spend: 1000, impressions: 1000, clicks: 20, landingPageView: 0, purchaseValue: 20000, purchaseCount: 1 },
    { date: "2026-07-31", spend: 2000, impressions: 5000, clicks: 50, landingPageView: 0, purchaseValue: 60000, purchaseCount: 2 },
  ];

  it("일별 클릭률·전환율·객단가·클릭당비용을 뽑는다", () => {
    const s = deriveLeadSeries(daily);
    expect(s.ctr).toEqual([2, 1]);
    expect(s.cvr).toEqual([0.05, 0.04]);
    expect(s.aov).toEqual([20000, 30000]);
    expect(s.cpc).toEqual([50, 40]);
  });

  it("분모가 0 인 날은 0 으로 두고 나눗셈을 하지 않는다", () => {
    const s = deriveLeadSeries([
      { date: "2026-07-30", spend: 0, impressions: 0, clicks: 0, landingPageView: 0, purchaseValue: 0, purchaseCount: 0 },
      ...daily,
    ]);
    expect(s.ctr[0]).toBe(0);
    expect(s.cpc[0]).toBe(0);
    expect(s.aov[0]).toBe(0);
  });

  it("최근 N 일만 남긴다", () => {
    expect(deriveLeadSeries(daily, 1).ctr).toEqual([1]);
  });
});

describe("leadProgressPct", () => {
  const map = deriveBackcastMap({ metric: "roas", target: 3.0 }, { roas: 2.1 }, MEASURED, null);
  const ctr = map.rows.find((r) => r.kind === "ctr")!;
  const cpc = map.rows.find((r) => r.kind === "cpc")!;

  it("기준선에 머물면 0%, 목표에 닿으면 100%", () => {
    expect(leadProgressPct(ctr, ctr.current)).toBeCloseTo(0, 6);
    expect(leadProgressPct(ctr, ctr.target)).toBeCloseTo(100, 6);
  });

  it("비용 지표는 내려간 만큼이 진척이다", () => {
    const mid = (cpc.current! + cpc.target!) / 2;
    expect(leadProgressPct(cpc, mid)).toBeCloseTo(50, 6);
  });

  it("범위 밖은 0~100 으로 자른다", () => {
    expect(leadProgressPct(ctr, 0)).toBe(0);
    expect(leadProgressPct(ctr, 99)).toBe(100);
  });

  it("실측이 없으면 진척도 없다", () => {
    expect(leadProgressPct(ctr, null)).toBeNull();
  });
});

describe("deriveGoalPace", () => {
  const base = {
    metric: "roas" as const,
    baseline: 2.1,
    target: 3.0,
    createdAt: "2026-07-26T00:00:00.000Z",
    periodDays: 30,
    now: new Date("2026-08-02T00:00:00.000Z"),
  };

  it("7일차에 33% 와 있으면 예상 경로(23%)보다 앞선다", () => {
    const pace = deriveGoalPace({ ...base, currentValue: 2.4 });
    expect(pace.progressPct).toBeCloseTo(33.33, 1);
    expect(pace.expectedPct).toBeCloseTo(23.33, 1);
    expect(pace.ahead).toBe(true);
    expect(pace.daysLeft).toBe(23);
  });

  it("뒤처지면 ahead 가 false", () => {
    const pace = deriveGoalPace({ ...base, currentValue: 2.15 });
    expect(pace.ahead).toBe(false);
  });

  it("CPA 는 내려간 만큼이 진척", () => {
    const pace = deriveGoalPace({ ...base, metric: "cpa", baseline: 14_000, target: 10_000, currentValue: 13_000 });
    expect(pace.progressPct).toBeCloseTo(25, 6);
  });

  it("시작값이 없으면 진척률을 지어내지 않는다 — 남은 일수는 그대로 센다", () => {
    const pace = deriveGoalPace({ ...base, baseline: null, currentValue: 2.4 });
    expect(pace.progressPct).toBeNull();
    expect(pace.daysLeft).toBe(23);
  });

  it("기간을 넘기면 남은 일수는 0", () => {
    const pace = deriveGoalPace({ ...base, currentValue: 2.4, now: new Date("2026-09-30T00:00:00.000Z") });
    expect(pace.daysLeft).toBe(0);
  });
});
