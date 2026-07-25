// ADR-062 Decision 5 — browse mock 크기는 "예시" 라벨(ADR-033). 3종 중 일부만 이미 존재하는
// 시나리오로 "만들기" 액션도 함께 시연할 수 있게 한다.

import { presetAudienceName, presetOf } from "./presets";
import type { CustomAudienceSummary } from "./types";

export const MOCK_CUSTOM_AUDIENCES: readonly CustomAudienceSummary[] = [
  {
    id: "mock_ca_ig_engagers",
    name: presetAudienceName(presetOf("ig_engagers")),
    approximateCountLowerBound: 8_200,
    approximateCountUpperBound: 9_600,
    deliveryStatus: "ready",
    isExample: true,
  },
  {
    id: "mock_ca_website_visitors",
    name: presetAudienceName(presetOf("website_visitors")),
    approximateCountLowerBound: 1_100,
    approximateCountUpperBound: 1_400,
    deliveryStatus: "ready",
    isExample: true,
  },
];
