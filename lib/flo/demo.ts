// 플로(Flo) browse mock 데이터 (ADR-033/045). 게스트는 실 Meta/IG 계정이 없으므로 데이터는
// mock — 그러나 Claude 호출은 실키로 진짜 추론을 시연한다. 룰 판정도 미리 박아넣어, 실 경로와
// 같은 모양(가짜 성과 의심·채널 제안)의 컨텍스트를 만든다.

import type { FloBrandFact, FloContext } from "./types";

export function demoFloContext(brand: FloBrandFact | undefined): FloContext {
  return {
    adAccountId: "browse",
    campaigns: [
      {
        headline: "여름 신상 원피스 컬렉션",
        objective: "OUTCOME_TRAFFIC",
        status: "live",
        impressions: 84_300,
        clicks: 2_410,
        ctr: 2.86,
        spend: 320_000,
        dailyBudget: 30_000,
        fakePerformance:
          "가짜 성과 의심 — CTR 2.86% 대비 도착률 38% (클릭 후 이탈 62%)",
      },
      {
        headline: "런칭 기념 한정 쿠폰",
        objective: "OUTCOME_SALES",
        status: "live",
        impressions: 51_200,
        clicks: 980,
        ctr: 1.91,
        spend: 210_000,
        dailyBudget: 25_000,
        fakePerformance: null,
      },
      {
        headline: "브랜드 스토리 인지도 캠페인",
        objective: "OUTCOME_AWARENESS",
        status: "live",
        impressions: 142_000,
        clicks: 510,
        ctr: 0.36,
        spend: 180_000,
        dailyBudget: 20_000,
        fakePerformance: null,
      },
    ],
    instagram: {
      channel: "instagram",
      followers: 8_420,
      engagementRate: 0.7,
      suggestions: ["인게이지먼트율이 낮아요", "오가닉 도달이 팔로워 대비 낮아요"],
    },
    facebook: {
      channel: "facebook",
      followers: 3_100,
      engagementRate: 1.4,
      suggestions: ["게시 빈도가 낮아요"],
    },
    tournaments: [
      {
        productName: "여름 원피스",
        objective: "OUTCOME_TRAFFIC",
        round: 2,
        latestVerdict: "challenger_win",
      },
    ],
    brand,
  };
}
