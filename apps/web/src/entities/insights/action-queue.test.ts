import { describe, it, expect } from "vitest";
import { deriveActionQueue, deriveHeroNarrative } from "./action-queue";
import { deriveConversionSummary } from "./period-kpis";
import type { CampaignSummary } from "@/lib/meta-ads";

// 둘러보기 목업과 같은 모양의 최소 캠페인. 날짜는 isFakePerformance 의 daysOfData 게이트(≥3일)를 넘기려고 넓게 잡는다.
function campaign(over: Partial<CampaignSummary>): CampaignSummary {
  return {
    id: "c1",
    name: "n",
    headline: "캠페인",
    status: "live",
    objective: "OUTCOME_TRAFFIC",
    goal: "트래픽",
    startDate: "2026-05-01",
    endDate: "2026-05-21",
    adSetId: "as1",
    adId: "ad1",
    dailyBudget: 50_000,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    spend: 0,
    issueReason: null,
    ...over,
  } as CampaignSummary;
}

// 가짜 성과 = CTR ≥ 2.0% + 도착률 < 50%.
const trap = campaign({
  id: "trap",
  headline: "여름 수분 충전",
  impressions: 56_706,
  clicks: 1_191,
  ctr: 2.1,
  spend: 482_000,
  linkClick: 1_072,
  landingPageView: 354,
});

// ROAS 2.48x — 마진 30% 기준 손익분기(3.33x) 아래.
const belowBep = campaign({
  id: "sales",
  headline: "가을 세일",
  objective: "OUTCOME_SALES",
  impressions: 76_500,
  clicks: 995,
  ctr: 1.3,
  spend: 612_000,
  purchaseCount: 46,
  purchaseValue: 1_518_000,
});

describe("deriveActionQueue", () => {
  it("도착이 새는 캠페인을 1순위로 올리고, 멈췄을 때 필요한 ROAS 를 같이 준다", () => {
    const [first] = deriveActionQueue({
      campaigns: [trap, belowBep],
      marginRate: 0.3,
      totalSpend: 2_416_381,
    });

    expect(first.accent).toBe("negative");
    expect(first.title).toContain("여름 수분 충전");
    expect(first.stats[0].value).toBe("₩482,000");
    // 두 캠페인 광고비를 전환 매출로 회수하려면 5.96x, 멈추면 손익분기 3.33x.
    expect(first.stats[1].value).toBe("5.96x → 3.33x");
  });

  it("손익분기 아래 전환 캠페인에는 증액을 권하지 않는다", () => {
    const items = deriveActionQueue({ campaigns: [belowBep], marginRate: 0.3, totalSpend: 612_000 });
    const conv = items.find((i) => i.id.startsWith("bep-"));

    expect(conv).toBeDefined();
    expect(conv!.title).toContain("손익분기 아래");
    expect(items.some((i) => i.id.startsWith("boost-"))).toBe(false);
    // 손익분기 CPA = 건당 매출 33,000 × 마진 30%.
    expect(conv!.stats[0].value).toBe("전환당 ₩9,900 이하로");
  });

  it("손익분기 위면 증액을 권하고 늘어날 공헌이익을 계산한다", () => {
    // ROAS 5x, 마진 30% → 손익분기 3.33x 위. 증액분 183,600 × (0.3×5 − 1) = +91,800.
    const above = campaign({
      id: "sales",
      headline: "잘 되는 세트",
      objective: "OUTCOME_SALES",
      spend: 612_000,
      purchaseCount: 46,
      purchaseValue: 3_060_000,
    });
    const [item] = deriveActionQueue({ campaigns: [above], marginRate: 0.3, totalSpend: 612_000 });

    expect(item.title).toContain("예산을 몰아주세요");
    expect(item.stats[0].value).toBe("공헌이익 +₩91,800 예상");
  });

  it("마진율이 없으면 손익 판정 대신 마진율부터 받는다", () => {
    const [item] = deriveActionQueue({ campaigns: [belowBep], marginRate: null, totalSpend: 612_000 });
    expect(item.buttons[0].target).toEqual({ kind: "margin" });
  });

  it("측정 안 되는 광고비가 있으면 커버리지 카드를 마지막에 붙인다", () => {
    const items = deriveActionQueue({
      campaigns: [trap, belowBep],
      marginRate: 0.3,
      totalSpend: 2_416_381,
    });
    const coverage = items[items.length - 1];

    expect(coverage.id).toBe("coverage");
    expect(coverage.body).toContain("25%");
    expect(coverage.body).toContain("₩1,804,381");
    expect(coverage.buttons[0].target).toEqual({ kind: "measurement" });
  });

  it("측정이 전부 붙어 있으면 커버리지 카드를 내지 않는다", () => {
    const items = deriveActionQueue({ campaigns: [belowBep], marginRate: 0.3, totalSpend: 612_000 });
    expect(items.some((i) => i.id === "coverage")).toBe(false);
  });

  it("최대 3건까지만 낸다", () => {
    const traps = [1, 2, 3, 4].map((i) => ({ ...trap, id: `trap${i}` }));
    expect(deriveActionQueue({ campaigns: traps, marginRate: 0.3, totalSpend: 2_000_000 })).toHaveLength(3);
  });
});

describe("deriveHeroNarrative", () => {
  const conversion = deriveConversionSummary([belowBep]);

  it("마진율이 있으면 손익분기 게이지까지 채운다", () => {
    const n = deriveHeroNarrative({ conversion, marginRate: 0.3, clicksDeltaPct: 57.9, cpcDeltaPct: -25 });

    expect(n!.contribution).toBe(-156_600);
    expect(n!.bep).toBe(3.33);
    expect(Math.round(n!.bepFillPct!)).toBe(74);
    expect(n!.supportLine).toContain("클릭은 57.9% 늘었고 CPC는 25% 싸졌어요.");
  });

  it("마진율이 없으면 공헌이익 자리를 비운다", () => {
    const n = deriveHeroNarrative({ conversion, marginRate: null });
    expect(n!.contribution).toBeNull();
    expect(n!.marginRevenue).toBeNull();
  });

  it("전환 데이터가 없으면 히어로를 만들지 않는다", () => {
    expect(deriveHeroNarrative({ conversion: null, marginRate: 0.3 })).toBeNull();
  });
});
