import { describe, it, expect } from "vitest";
import { deriveFunnelBreakdown, landingRateOf, type FunnelBreakdownCampaign } from "./funnel-breakdown";

describe("landingRateOf", () => {
  it("linkClick null → 측정 안 됨(null)", () => {
    expect(landingRateOf({ landingPageView: 10 })).toBeNull();
  });

  it("linkClick 0 → 분모 0, null", () => {
    expect(landingRateOf({ linkClick: 0, landingPageView: 10 })).toBeNull();
  });

  it("정상 분모 = linkClick(clicks 아님)", () => {
    expect(landingRateOf({ linkClick: 50, landingPageView: 25 })).toBe(0.5);
  });

  it("landingPageView 없으면 0 취급", () => {
    expect(landingRateOf({ linkClick: 100 })).toBe(0);
  });
});

describe("deriveFunnelBreakdown", () => {
  const camp = (p: Partial<FunnelBreakdownCampaign> & { id: string }): FunnelBreakdownCampaign => ({
    ...p,
  });

  it("linkClick 미측정 캠페인은 도착 랭킹·측정 카운트에서 제외", () => {
    const result = deriveFunnelBreakdown([
      camp({ id: "a", linkClick: 100, landingPageView: 50 }),
      camp({ id: "b" }), // linkClick 미측정
    ]);
    expect(result.landing.measuredCount).toBe(1);
    expect(result.landing.rates.map((r) => r.id)).toEqual(["a"]);
  });

  it("도착률 분모 정확성 — linkClick 기준", () => {
    const result = deriveFunnelBreakdown([camp({ id: "a", linkClick: 40, landingPageView: 10 })]);
    expect(result.landing.rates[0]).toEqual({ id: "a", rate: 0.25 });
  });

  it("purchaseCount 미측정은 구매 단 제외", () => {
    const result = deriveFunnelBreakdown([
      camp({ id: "a", linkClick: 100, purchaseCount: 5 }),
      camp({ id: "b", linkClick: 100 }), // purchaseCount 미측정
    ]);
    expect(result.purchase.measuredCount).toBe(1);
    expect(result.purchase.rates.map((r) => r.id)).toEqual(["a"]);
  });

  it("측정된 N개 카운트 반환(분모 명시용)", () => {
    const result = deriveFunnelBreakdown([
      camp({ id: "a", linkClick: 100, landingPageView: 50, purchaseCount: 2 }),
      camp({ id: "b", linkClick: 200, landingPageView: 80 }),
      camp({ id: "c" }),
    ]);
    expect(result.landing.measuredCount).toBe(2);
    expect(result.purchase.measuredCount).toBe(1);
  });
});
