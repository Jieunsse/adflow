// ADR-030 — 가짜 성과 의심 = 클릭↔랜딩 누수 판정 (isWinner 의 거울상).
// Vanity(보이는 지표) ✓ + Substance(깊은 지표) ✗ 인 의심 상태.
// 트래픽 "페이지 방문" 캠페인 한정 — landing_page_view action 존재 여부로 픽셀 미보유를 자동 차단.

import {
  MIN_IMPRESSIONS,
  MIN_DAYS,
  GOOD_CTR_PCT,
  MIN_LINK_CLICKS_FOR_FAKE,
  LOW_LANDING_RATE_PCT,
} from "./thresholds";

export type FakePerformanceInput = {
  impressions: number;
  ctr: number;        // %
  linkClick: number;  // actions[].link_click
  // actions[].landing_page_view — undefined = 픽셀이 측정 안 함(action 자체가 안 옴) → 판정 안 함.
  // 0 은 "측정됐는데 도착이 없음" 이라 의심 대상.
  landingPageView?: number;
};

export type FakePerformanceEvidence = {
  ctr: number;          // %
  landingRate: number;  // % — landingPageView / linkClick
  dropRate: number;     // % — 100 - landingRate
};

export function isFakePerformance(
  ins: FakePerformanceInput,
  daysOfData: number,
): { fake: boolean; evidence: FakePerformanceEvidence | null } {
  // 게이트: 표본·기간·측정 가능 여부.
  if (ins.impressions < MIN_IMPRESSIONS || daysOfData < MIN_DAYS) return { fake: false, evidence: null };
  if (ins.linkClick < MIN_LINK_CLICKS_FOR_FAKE) return { fake: false, evidence: null };
  if (ins.landingPageView == null) return { fake: false, evidence: null };

  const landingRate = (ins.landingPageView / ins.linkClick) * 100;

  // Vanity ✓ (CTR 통과) + Substance ✗ (도착률 미달).
  if (!(ins.ctr >= GOOD_CTR_PCT && landingRate < LOW_LANDING_RATE_PCT)) {
    return { fake: false, evidence: null };
  }

  return {
    fake: true,
    evidence: {
      ctr: ins.ctr,
      landingRate: Math.round(landingRate * 10) / 10,
      dropRate: Math.round((100 - landingRate) * 10) / 10,
    },
  };
}
