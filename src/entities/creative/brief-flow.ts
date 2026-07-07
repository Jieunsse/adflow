// PRD-create-flow-redesign §3 — 브리프(step 0) 진행·게이트 판정. page.tsx 오케스트레이터의
// 조건 분기를 순수 함수로 분리해 회귀 테스트 대상으로 삼는다(ADR-002).

import type { OutcomeChip } from "./options";
import { isBoost } from "./outcome-routing";

// 브리프 "소재 만들기 시작" 클릭 시 다음 step. boost 는 스튜디오(1)를 건너뛰고 게재(2)로 직행.
export function nextStepAfterBrief(outcome: OutcomeChip | null): 1 | 2 {
  return isBoost(outcome) ? 2 : 1;
}

// generate-first(§3.1) — 스튜디오 진입 시 자동 생성 트리거 여부.
// 생성 결과가 아직 없거나, 마지막 생성 대상 outcome 과 지금 outcome 이 다르면 재생성.
export function shouldTriggerGenerate(
  hasGeneratedHeadlines: boolean,
  lastGeneratedOutcome: OutcomeChip | null,
  currentOutcome: OutcomeChip | null,
): boolean {
  return !hasGeneratedHeadlines || lastGeneratedOutcome !== currentOutcome;
}

// 01→02(브리프→스튜디오) 게이트: 목표 선택 여부.
export function isBriefDone(outcome: OutcomeChip | null): boolean {
  return outcome !== null;
}

// 02→03(스튜디오→게재) 게이트: boost 는 항상 통과, 아니면 헤드라인+이미지 존재.
export function isStudioDone(outcome: OutcomeChip | null, hasHeadline: boolean, hasImage: boolean): boolean {
  return isBoost(outcome) || (hasHeadline && hasImage);
}
