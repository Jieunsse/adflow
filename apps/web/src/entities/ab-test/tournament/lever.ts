// PRD 가설 기반 A/B (ADR-044) — 레버 taxonomy. 가설이 건드리는 변형 차원의 구조화 키.
// 카피 각도 8종 = 기존 Copy Hook(ADR-029)을 그대로 흡수(동일 키 재사용) — 자유 서술을 금지해야
// Ledger 집계·중복 회피가 가능하기 때문(PRD 비목표). 비카피 5축 신설. image-scene 은 자동 순회 제외(후속).
// "use client" 없음 — 서버 데모 라우트(transitions)가 import 한다.

import { COPY_HOOK_MAP, type CopyHook } from "@entities/creative/options";

export type CopyLever = CopyHook;
export type NonCopyLever =
  | "audience-framing" // 누구에게 말하나 (세그먼트 호명)
  | "value-prop" // 핵심 제안 자체
  | "proof" // Proof Point 활용 (ADR-031)
  | "image-scene" // 이미지 연출 (ADR-040/041 Image Concept)
  | "format"; // 길이·구조 (짧게/길게, 리스트/서사)
export type Lever = CopyLever | NonCopyLever;

export const COPY_LEVER_IDS: CopyLever[] = [
  "benefit", "trust", "number", "rush", "unique", "trendy", "surprise", "story",
];
export const NON_COPY_LEVER_IDS: NonCopyLever[] = [
  "audience-framing", "value-prop", "proof", "image-scene", "format",
];
export const ALL_LEVERS: Lever[] = [...COPY_LEVER_IDS, ...NON_COPY_LEVER_IDS];

const COPY_LEVER_SET = new Set<string>(COPY_LEVER_IDS);

const NON_COPY_LABEL: Record<NonCopyLever, string> = {
  "audience-framing": "타깃 호명",
  "value-prop": "핵심 제안",
  proof: "근거 제시",
  "image-scene": "이미지 연출",
  format: "구성·길이",
};

export function isCopyLever(l: Lever): l is CopyLever {
  return COPY_LEVER_SET.has(l);
}

export function leverLabel(l: Lever): string {
  return isCopyLever(l) ? COPY_HOOK_MAP[l].ko : NON_COPY_LABEL[l];
}

// 레버별 가설 문장·근거 골자 (데모 결정적 생성용). {metric} 은 목표 지표명으로 치환.
// 실 유저 경로의 Gemini suggestHypothesis 는 후속 — 데모는 이 템플릿으로 근거 강제를 충족한다.
export const LEVER_HYPOTHESIS: Record<Lever, { claim: string; rationale: string }> = {
  benefit: { claim: "혜택을 먼저 말하면 {metric}이 오른다", rationale: "이 브랜드 고객은 '효과'를 먼저 확인하려는 경향이 강해요." },
  trust: { claim: "근거·후기로 신뢰를 주면 {metric}이 오른다", rationale: "민감 카테고리라 신뢰 신호가 클릭을 좌우해요." },
  number: { claim: "구체적 수치로 설득하면 {metric}이 오른다", rationale: "Proof Point 의 재구매율·성분 수치를 카피에 쓸 수 있어요." },
  rush: { claim: "긴박감을 주면 {metric}이 오른다", rationale: "한정·시즌 맥락에서 즉시 행동 유인이 통할 수 있어요." },
  unique: { claim: "차별점을 분명히 하면 {metric}이 오른다", rationale: "경쟁 제품과 겹치는 메시지에서 벗어나면 주목도가 올라가요." },
  trendy: { claim: "요즘 흐름에 얹으면 {metric}이 오른다", rationale: "타깃 연령대가 트렌드 키워드에 민감해요." },
  surprise: { claim: "예상을 뒤집는 훅이 {metric}을 올린다", rationale: "스크롤을 멈추게 하는 반전이 노출 대비 클릭을 끌어올려요." },
  story: { claim: "이야기로 몰입시키면 {metric}이 오른다", rationale: "브랜드 보이스가 서사형이라 스토리 훅과 잘 맞아요." },
  "audience-framing": { claim: "세그먼트를 직접 호명하면 {metric}이 오른다", rationale: "페르소나를 콕 집으면 '내 얘기' 반응이 나와요." },
  "value-prop": { claim: "핵심 제안 자체를 바꾸면 {metric}이 오른다", rationale: "표현보다 제안이 약할 때 제안을 손볼 여지가 있어요." },
  proof: { claim: "Proof Point 를 전면에 쓰면 {metric}이 오른다", rationale: "보유한 근거 자료를 카피에 직접 노출해 신뢰를 높여요." },
  "image-scene": { claim: "이미지 연출을 바꾸면 {metric}이 오른다", rationale: "씬·구도가 시선을 먼저 잡아 클릭에 영향을 줘요." },
  format: { claim: "길이·구조를 바꾸면 {metric}이 오른다", rationale: "짧게/리스트형이 모바일 가독성에서 유리할 수 있어요." },
};

// 레버가 변형하는 카피 슬롯 — 단일 가설이 건드리는 슬롯을 묶음으로 교체(다축 허용, 단일 가설 불변식).
// 데모는 슬롯별 귀속을 하지 않으므로(PRD 비목표) 헤드라인/카피 중 하나로 결정적 매핑한다.
const HEADLINE_LEVERS = new Set<Lever>([
  "benefit", "number", "surprise", "trendy", "unique", "value-prop", "audience-framing",
]);

export function leverSwapsHeadline(l: Lever): boolean {
  return HEADLINE_LEVERS.has(l);
}
