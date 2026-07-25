// ADR-052 — 생성 순간 보상 넛지. 빈 브랜드 프로필 필드 중 이 outcome 에 가장 효과 큰 1개만 권한다.
// 빈 필드에 대한 *사실 진술* 이라 진실성 위험 없음(LLM 미사용 — selectNextLever 가지치기와 동류).

import { findObjective, type ObjectiveId, type MetaObjective } from "./options";

export type ProfileNudgeTarget =
  | "persona" | "product" | "proofPoints" | "imageGuide" | "tone" | "brandVoice";

export interface ProfileNudge {
  target: ProfileNudgeTarget;
  reason: string;
}

// outcome 계열(metaObjective)별 빈 필드 채움 우선순위 — 노출형은 비주얼·타겟, 전환형은 근거·제품 우선.
const NUDGE_PRIORITY: Record<MetaObjective, ProfileNudgeTarget[]> = {
  OUTCOME_AWARENESS:     ["persona", "imageGuide", "brandVoice", "product", "proofPoints", "tone"],
  OUTCOME_ENGAGEMENT:    ["persona", "imageGuide", "brandVoice", "product", "proofPoints", "tone"],
  OUTCOME_TRAFFIC:       ["proofPoints", "persona", "product", "imageGuide", "brandVoice", "tone"],
  OUTCOME_LEADS:         ["proofPoints", "persona", "product", "imageGuide", "brandVoice", "tone"],
  OUTCOME_SALES:         ["proofPoints", "product", "persona", "imageGuide", "brandVoice", "tone"],
  OUTCOME_APP_PROMOTION: ["product", "proofPoints", "persona", "imageGuide", "brandVoice", "tone"],
};

// 빈 필드에 대한 사실 진술 — 과장·미검증 효과 약속 금지(ADR-052).
export const NUDGE_REASON: Record<ProfileNudgeTarget, string> = {
  persona:     "타겟 페르소나를 더하면 그 사람의 언어로 카피가 더 날카로워져요.",
  product:     "제품을 등록하면 제품 강점을 살린 카피를 만들 수 있어요.",
  proofPoints: "근거 자료를 더하면 카피에 믿을 수 있는 수치를 인용할 수 있어요.",
  imageGuide:  "이미지 가이드를 더하면 브랜드에 맞는 비주얼 방향이 잡혀요.",
  tone:        "광고 느낌(톤)을 정하면 카피 분위기가 일관돼요.",
  brandVoice:  "브랜드 보이스를 더하면 브랜드다운 말투가 살아나요.",
};

export const NUDGE_LABEL: Record<ProfileNudgeTarget, string> = {
  persona: "페르소나",
  product: "제품",
  proofPoints: "근거 자료",
  imageGuide: "이미지 가이드",
  tone: "톤",
  brandVoice: "브랜드 보이스",
};

// outcome 조건부 결정적 단일 넛지 — 빈 필드 중 우선순위 1개만. 빈 필드 없으면 null.
export function selectProfileNudge(
  outcome: ObjectiveId,
  filled: Record<ProfileNudgeTarget, boolean>,
): ProfileNudge | null {
  const order = NUDGE_PRIORITY[findObjective(outcome).metaObjective];
  const target = order.find((t) => !filled[t]);
  return target ? { target, reason: NUDGE_REASON[target] } : null;
}
