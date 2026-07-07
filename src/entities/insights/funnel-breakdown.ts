// ADR-063 — 퍼널 캠페인 드릴다운. 각 단(도착·구매)의 캠페인별 전환율 + 측정 여부만 파생.
// 클릭 단은 기존 CampaignTable ctr 정렬이 이미 답 — 여기서 값을 만들지 않는다.
// 도착률 분모 = linkClick(clicks 아님, ADR-030). linkClick == null → 측정 안 됨(랭킹·전환율 계산 제외).

export type FunnelBreakdownCampaign = {
  id: string;
  linkClick?: number;
  landingPageView?: number;
  purchaseCount?: number;
};

export type CampaignConversionRate = {
  id: string;
  rate: number; // 0..1
};

export type FunnelBreakdown = {
  landing: { rates: CampaignConversionRate[]; measuredCount: number };
  purchase: { rates: CampaignConversionRate[]; measuredCount: number };
};

// period-kpis.ts 의 CampaignTableRow.landingRate 도 이 계산을 재사용(단일 출처).
// linkClick == null → 측정 안 됨(null). linkClick === 0 → 분모 0 이라 계산 불가(null).
export function landingRateOf(c: { linkClick?: number; landingPageView?: number }): number | null {
  if (c.linkClick == null || c.linkClick <= 0) return null;
  return (c.landingPageView ?? 0) / c.linkClick;
}

export function deriveFunnelBreakdown(campaigns: FunnelBreakdownCampaign[]): FunnelBreakdown {
  const landingMeasured = campaigns.filter((c) => c.linkClick != null);
  const landingRates: CampaignConversionRate[] = landingMeasured
    .map((c) => ({ id: c.id, rate: landingRateOf(c) }))
    .filter((r): r is CampaignConversionRate => r.rate != null);

  const purchaseMeasured = campaigns.filter((c) => c.linkClick != null && c.purchaseCount != null);
  const purchaseRates: CampaignConversionRate[] = purchaseMeasured
    .filter((c) => (c.linkClick ?? 0) > 0)
    .map((c) => ({ id: c.id, rate: (c.purchaseCount as number) / (c.linkClick as number) }));

  return {
    landing: { rates: landingRates, measuredCount: landingMeasured.length },
    purchase: { rates: purchaseRates, measuredCount: purchaseMeasured.length },
  };
}
