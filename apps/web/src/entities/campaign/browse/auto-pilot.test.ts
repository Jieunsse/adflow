import { describe, it, expect } from "vitest";
import { evaluateAutoPilot, applyAutoPilotAction, currentDailyBudget } from "./auto-pilot";
import type { BrowseCampaign } from "./types";

// CTR 은 baseDailyClicks/baseDailyImpressions 로 결정(예산 무관). 호조=2.40%, 망조=1.19%(준비OK·Winner미달).
function camp(extra?: Partial<BrowseCampaign>): BrowseCampaign {
  return {
    id: "browse_test",
    name: "t",
    headline: "h",
    primaryText: "p",
    cta: "SHOP_NOW",
    imagePrompt: "",
    imageUrl: "",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 50000,
    baseDailyImpressions: 4200,
    baseDailyClicks: 101,
    baseDailySpend: 60000,
    startDate: "2026-05-01",
    status: "live",
    fastForwardDays: 9,
    cycle: 1,
    ageMin: 20,
    ageMax: 40,
    genders: [],
    countries: ["KR"],
    createdAt: "2026-05-01T00:00:00.000Z",
    ...extra,
  };
}

describe("evaluateAutoPilot", () => {
  it("호조(CTR≥2%)면 예산을 +30% 증액 제안한다", () => {
    const a = evaluateAutoPilot(camp(), 9);
    expect(a?.kind).toBe("increase-budget");
    expect(a?.fromBudget).toBe(50000);
    expect(a?.toBudget).toBe(65000);
  });

  it("망조(CTR<2%) + decrease 정책이면 예산을 -30% 감액한다", () => {
    const a = evaluateAutoPilot(camp({ baseDailyClicks: 50, automationPolicy: "decrease" }), 9);
    expect(a?.kind).toBe("decrease-budget");
    expect(a?.toBudget).toBe(35000);
  });

  it("망조 + pause 정책이면 광고를 정지한다", () => {
    const a = evaluateAutoPilot(camp({ baseDailyClicks: 50, automationPolicy: "pause" }), 9);
    expect(a?.kind).toBe("pause");
  });

  it("이미 종료된 캠페인은 조치하지 않는다", () => {
    expect(evaluateAutoPilot(camp({ status: "ended" }), 9)).toBeNull();
  });

  it("현재 예산은 마지막 budgetChange 를 따른다 — 증액은 그 위에서 누적", () => {
    const c = camp({ budgetChanges: [{ atDay: 9, dailyBudget: 65000 }] });
    expect(currentDailyBudget(c)).toBe(65000);
    expect(evaluateAutoPilot(c, 16)?.toBudget).toBe(85000); // 65000*1.3=84500→85000
  });
});

describe("applyAutoPilotAction", () => {
  it("예산 조치는 budgetChanges + autoActions 에 누적된다", () => {
    const c = camp();
    const a = evaluateAutoPilot(c, 9)!;
    const next = applyAutoPilotAction(c, a);
    expect(next.budgetChanges).toEqual([{ atDay: 9, dailyBudget: 65000 }]);
    expect(next.autoActions).toHaveLength(1);
    expect(next.status).toBe("live");
  });

  it("정지 조치는 status 를 ended 로 바꾼다", () => {
    const c = camp({ baseDailyClicks: 50, automationPolicy: "pause" });
    const next = applyAutoPilotAction(c, evaluateAutoPilot(c, 9)!);
    expect(next.status).toBe("ended");
    expect(next.autoActions).toHaveLength(1);
  });
});
