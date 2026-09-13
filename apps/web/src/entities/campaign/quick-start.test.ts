import { describe, expect, it } from "vitest";
import { datesForQuickStart, latestQuickStart } from "./quick-start";

describe("datesForQuickStart", () => {
  it("이전 기간 길이만 이어받아 오늘부터 다시 잡아요", () => {
    expect(datesForQuickStart(7, new Date("2026-08-12T12:00:00Z"))).toEqual({
      start: "2026-08-12",
      end: "2026-08-18",
    });
  });
});

describe("latestQuickStart", () => {
  it("선택한 제품의 가장 최근 성공 설정만 찾아요", () => {
    const settings = quickStart({ productId: "prd_1" });
    expect(latestQuickStart([launched(settings)], null, "prd_1")?.settings).toBe(settings);
  });

  it("제품을 특정할 수 없으면 브랜드의 최신 설정을 써요", () => {
    const settings = quickStart({ brandProfileId: "bp_1", productId: "prd_1" });
    expect(latestQuickStart([launched(settings)], "bp_1", null)?.settings).toBe(settings);
  });
});

function quickStart(ids: { brandProfileId?: string; productId?: string }) {
  return {
    ...ids,
    target: "고객",
    tone: "pro",
    outcomeHint: "",
    cta: "sample" as const,
    dailyBudget: "50,000",
    durationDays: 7,
    ageMin: 22,
    ageMax: 39,
    gender: "all" as const,
    countries: ["KR"],
    personaLocation: [],
    landingUrl: "",
    delivery: "PAUSED" as const,
    platforms: "both" as const,
  };
}

function launched(quickStart: ReturnType<typeof quickStart>) {
  return {
    campaignId: "camp_1",
    adSetId: "set",
    dailyBudget: 50000,
    startDate: "2026-08-01",
    endDate: "2026-08-07",
    status: "PAUSED" as const,
    quickStart,
  };
}
