import { describe, expect, it } from "vitest"
import { getBrowseDashboardCampaigns } from "./mock-campaigns"

describe("getBrowseDashboardCampaigns", () => {
  it("좋은 예시와 나쁜 예시를 반대 손익 상황으로 제공한다", () => {
    const good = getBrowseDashboardCampaigns("good")
    const poor = getBrowseDashboardCampaigns("poor")
    const goodSales = good.find((campaign) => campaign.objective === "OUTCOME_SALES")!
    const poorSales = poor.find((campaign) => campaign.objective === "OUTCOME_SALES")!

    expect(goodSales.purchaseValue! / goodSales.spend).toBeGreaterThan(1)
    expect(poorSales.purchaseValue! / poorSales.spend).toBeLessThan(1)
    expect(poor.find((campaign) => campaign.landingPageView! / campaign.linkClick! < 0.5)).toBeDefined()
  })
})
