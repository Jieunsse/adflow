// Outcome 칩에서 파생되는 모든 사실의 단일 모듈. OBJECTIVES_PHASE1 이 유일 source —
// 평면 매핑 Record(구 OUTCOME_TO_OBJECTIVE/OUTCOME_TO_CTA)는 폐기(중복 제거).
//
// selectOutcome — single-select 상태 전이:
//   (a) 같은 chip 재선택 → 해제 (null)
//   (b) 다른 chip 선택 → 교체. 새 chip 의 metaObjective / defaultCta 로 재도출
//   (c) chip=null 명시 → 해제, cta 는 현재값 유지 (사용자가 자유 입력한 cta 보존)
//
// 순수 함수 — 단위 테스트 가능. Reducer 는 selectOutcome 1-line 호출만.

import type { CtaId, Objective, OutcomeChip } from "./options";
import { findObjective } from "./options";

// chip → OBJECTIVES_ALL 엔트리. findObjective(단일 lookup) 재사용 + null-safe 래핑.
export function goalDefOf(outcome: OutcomeChip | null) {
  return outcome ? findObjective(outcome) : null;
}

// chip → Meta Campaign Objective.
export function objectiveOf(outcome: OutcomeChip | null): Objective | null {
  return goalDefOf(outcome)?.metaObjective ?? null;
}

// chip → 자동 적용 default CTA (디테일 모드 override 가능).
export function ctaDefaultOf(outcome: OutcomeChip): CtaId | undefined {
  return findObjective(outcome)?.defaultCta;
}

// Boost Post 흐름 분기 — 흩어져 있던 `outcome === 'boost_post'` 의 단일 술어.
export function isBoost(outcome: OutcomeChip | null): boolean {
  return outcome === "boost_post";
}

export type OutcomeRoutingResult = {
  outcome: OutcomeChip | null;
  objective: Objective | null;
  cta: CtaId;
};

export function selectOutcome(
  prev: OutcomeChip | null,
  next: OutcomeChip | null,
  currentCta: CtaId,
): OutcomeRoutingResult {
  // 해제 (null 토글) 또는 같은 chip 재선택
  if (next === null || prev === next) {
    return { outcome: null, objective: null, cta: currentCta };
  }
  // 새 chip 선택 — Meta config 와 CTA 모두 재도출
  return {
    outcome: next,
    objective: objectiveOf(next),
    cta: ctaDefaultOf(next) ?? currentCta,
  };
}
