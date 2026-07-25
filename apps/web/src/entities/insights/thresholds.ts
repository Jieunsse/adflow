// Shared performance thresholds used by both server-side winner detection
// (lib/optimization.ts) and client-side suggestion engine (optimization.ts).

export const MIN_IMPRESSIONS = 1_000;
export const MIN_DAYS = 3;

export const GOOD_CTR_PCT = 2.0;
export const HIGH_CPC_KRW = 2000;
export const HIGH_FREQUENCY = 3.0;
export const HIGH_CPM_KRW = 8000;
export const GOOD_ENGAGEMENT_RATE = 2.5;

// ADR-030 — 가짜 성과 의심(클릭↔랜딩 누수) 판정.
export const MIN_LINK_CLICKS_FOR_FAKE = 50; // 표본 가드
export const LOW_LANDING_RATE_PCT = 50;     // 랜딩 도착률 < 50% = Substance 미달

// 목표 설정 — 진척 판정 여유 구간(goal.ts).
export const GOAL_AT_RISK_LOWER_RATIO = 0.8; // roas/contribution: target × 0.8 이상이면 at-risk
export const GOAL_AT_RISK_UPPER_RATIO = 1.2; // cpa: target × 1.2 이하면 at-risk
