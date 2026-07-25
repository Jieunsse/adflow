import { describe, it, expect } from "vitest";
import { buildBrowseInsights } from "./insights";
import { BROWSE_SEED } from "./seed";
import { isWinner } from "@/lib/optimization";
import type { BrowseCampaign } from "./types";

function campAt(days: number, extra?: Partial<BrowseCampaign>): BrowseCampaign {
  return {
    ...BROWSE_SEED,
    id: "browse_test",
    startDate: "2026-05-01",
    createdAt: "2026-05-01T00:00:00.000Z",
    fastForwardDays: days,
    ...extra,
  };
}

describe("buildBrowseInsights", () => {
  it("막 시드된(0일차) 캠페인은 빈 성과를 낸다", () => {
    const ins = buildBrowseInsights(campAt(0));
    expect(ins.impressions).toBe(0);
    expect(ins.clicks).toBe(0);
    expect(ins.spend).toBe(0);
    expect(ins.daily).toHaveLength(0);
  });

  it("N일차는 N개의 일별 row 를 만들고 합계가 일별 합과 일치한다", () => {
    const ins = buildBrowseInsights(campAt(9));
    expect(ins.daily).toHaveLength(9);
    expect(ins.impressions).toBe(ins.daily.reduce((s, d) => s + (d.impressions ?? 0), 0));
    expect(ins.clicks).toBe(ins.daily.reduce((s, d) => s + d.clicks, 0));
    expect(ins.spend).toBe(ins.daily.reduce((s, d) => s + d.spend, 0));
    // CTR 은 클릭/노출에서 도출 — 시드 비율(101/4200 ≈ 2.4%) 부근.
    expect(ins.ctr).toBeCloseTo((ins.clicks / ins.impressions) * 100, 6);
    expect(ins.ctr).toBeGreaterThan(2.0);
  });

  it("같은 캠페인이면 항상 같은 성과를 낸다 (결정적)", () => {
    expect(buildBrowseInsights(campAt(9))).toEqual(buildBrowseInsights(campAt(9)));
  });
});

// 예산 증액 액션(③)의 계단식 효과 — 변곡점 이전 날은 불변, 이후 날은 볼륨×비율, CTR·CPC 불변.
describe("budgetChanges 계단식 증액", () => {
  const ratio = 65000 / BROWSE_SEED.dailyBudget; // +30% (50000→65000)

  it("변곡점 이전 일자는 증액 전과 완전히 동일하다 (소급 없음)", () => {
    const base = buildBrowseInsights(campAt(7));
    const bumped = buildBrowseInsights(campAt(7, { budgetChanges: [{ atDay: 4, dailyBudget: 65000 }] }));
    for (let i = 0; i < 4; i++) {
      expect(bumped.daily[i]).toEqual(base.daily[i]);
    }
  });

  it("변곡점 이후 일자는 노출·클릭·지출이 비율만큼 늘고 CTR·CPC 는 유지된다", () => {
    const base = buildBrowseInsights(campAt(7));
    const bumped = buildBrowseInsights(campAt(7, { budgetChanges: [{ atDay: 4, dailyBudget: 65000 }] }));
    for (let i = 4; i < 7; i++) {
      // 볼륨은 비율만큼 스케일 — 라운딩 차이만 허용(±1).
      expect(bumped.daily[i].impressions! / base.daily[i].impressions!).toBeCloseTo(ratio, 2);
      expect(bumped.daily[i].clicks / base.daily[i].clicks).toBeCloseTo(ratio, 1);
      expect(bumped.daily[i].spend / base.daily[i].spend).toBeCloseTo(ratio, 2);
      // CTR(클릭/노출)은 볼륨 스케일에 불변.
      expect(bumped.daily[i].ctr).toBeCloseTo(base.daily[i].ctr, 1);
    }
  });

  it("변곡점이 현재 일수 이상이면(아직 미반영) 성과는 증액 전과 같다", () => {
    const base = buildBrowseInsights(campAt(2));
    const pending = buildBrowseInsights(campAt(2, { budgetChanges: [{ atDay: 2, dailyBudget: 65000 }] }));
    expect(pending).toEqual(base);
  });
});

// 시연의 핵심 약속: 시드 직후엔 winner 가 아니지만, 빨리감기로 데이터가 쌓이면 winner 가 된다.
// buildBrowseInsights ↔ 실제 isWinner ↔ thresholds 의 결합을 고정 — 셋 중 하나라도 어긋나면 시연이 깨짐.
describe("시연 핵심 약속 (buildBrowseInsights × isWinner)", () => {
  it("시드 직후(2일차)는 아직 winner 가 아니다 — MIN_DAYS 미달", () => {
    const c = campAt(BROWSE_SEED.fastForwardDays); // 2
    const r = isWinner(buildBrowseInsights(c), c.objective, null, c.fastForwardDays);
    expect(r.winner).toBe(false);
  });

  it("빨리감기로 9일차가 되면 기준 임계값 경로로 winner 가 된다", () => {
    const c = campAt(9);
    const r = isWinner(buildBrowseInsights(c), c.objective, null, c.fastForwardDays);
    expect(r.winner).toBe(true);
    expect(r.evidence?.kind).toBe("threshold");
  });

  it("KPI Target(CTR≥2%)을 전달하면 kpi-target 경로로 winner 가 된다", () => {
    const c = campAt(9, { kpiTarget: [{ kpi: "ctr", value: 2.0, direction: "gte" }] });
    const r = isWinner(buildBrowseInsights(c), c.objective, c.kpiTarget ?? null, c.fastForwardDays);
    expect(r.winner).toBe(true);
    expect(r.evidence?.kind).toBe("kpi-target");
  });
});
