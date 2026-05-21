// Outcome chip → Campaign Objective + CTA 매핑 (.document/CONTEXT.md §Outcome, PRD §13.10).
// Single-select 모델:
//   (a) 같은 chip 재선택 → 해제 (null)
//   (b) 다른 chip 선택 → 교체. 새 chip 의 OUTCOME_TO_OBJECTIVE / OUTCOME_TO_CTA 로 재도출
//   (c) chip=null 명시 → 해제, cta 는 현재값 유지 (사용자가 자유 입력한 cta 보존)
//
// 순수 함수 — 단위 테스트 가능. Reducer 는 1-line 호출만.

import type { CtaId, Objective, OutcomeChip } from "./options";
import { OUTCOME_TO_CTA, OUTCOME_TO_OBJECTIVE } from "./options";

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
    objective: OUTCOME_TO_OBJECTIVE[next],
    cta: OUTCOME_TO_CTA[next] ?? currentCta,
  };
}
