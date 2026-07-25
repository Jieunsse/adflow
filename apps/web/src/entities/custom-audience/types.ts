// ADR-062 — 맞춤 타겟(Custom Audience) 프리셋 3종. .document/CONTEXT.md §CustomAudience.

export type AudiencePresetId = "ig_engagers" | "website_visitors" | "purchasers";

// GET /act_x/customaudiences 응답 매핑. approximate_count 는 Meta 가 범위로 준다 —
// 단일 숫자 합성 금지(ADR-031 정합).
export interface CustomAudienceSummary {
  id: string;
  name: string;
  approximateCountLowerBound?: number;
  approximateCountUpperBound?: number;
  deliveryStatus?: string;
  // browse mock 오디언스 표시 — 실 API 응답에는 없음.
  isExample?: boolean;
}
