// PRD-create-flow-redesign §3.3 — 게재 계획서 카드 스택의 판정 순수 함수.
// LaunchStep widget 이 "왜 지금 게재 버튼이 막혀있는가"를 1줄로 설명하고,
// "어느 카드가 문제인가"를 식별할 수 있도록 조건 분기를 여기 모은다.

export type PlanCardId = "destination" | "target";

export interface LaunchGateInput {
  hasCreative: boolean;
  accountConnected: boolean;
  browseMode: boolean;
  countriesCount: number;
  urlRequired: boolean;
  httpsOk: boolean;
  isPending: boolean;
  alreadyLaunched: boolean;
}

// 게재 버튼 비활성 사유 — 우선순위 고정 (계정 → 소재 → URL → 국가). null = 게재 가능.
export function launchBlockReason(input: LaunchGateInput): string | null {
  if (input.alreadyLaunched) return null;
  if (input.isPending) return "Meta에 전송하는 중이에요.";
  if (!input.accountConnected && !input.browseMode) return "광고 계정·페이지가 연결되지 않았어요.";
  if (!input.hasCreative) return "광고 소재가 없어요. 스튜디오에서 먼저 만들어주세요.";
  if (input.urlRequired && !input.httpsOk) return "도착지 URL이 필요해요.";
  if (input.countriesCount === 0) return "타겟 국가를 1개 이상 선택해주세요.";
  return null;
}

// 첫 문제 카드 식별 — scrollIntoView 대상. launchBlockReason 과 우선순위 동일하되 계정 카드는 별도 UI 없어 제외.
export function firstInvalidCard(input: Pick<LaunchGateInput, "urlRequired" | "httpsOk" | "countriesCount">): PlanCardId | null {
  if (input.urlRequired && !input.httpsOk) return "destination";
  if (input.countriesCount === 0) return "target";
  return null;
}
