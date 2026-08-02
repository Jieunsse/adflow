// 시안 2b "AI로 고치기" 칩. 라벨(화면)과 지시문(생성 프롬프트)을 한 자리에 둔다 —
// 둘러보기는 지시문 대신 같은 id 로 로컬 변환을 태우므로 id 가 두 경로의 공통 키다.

export type RefineId = "shorter" | "softer" | "numbers" | "cta";

export const REFINE_PRESETS: { id: RefineId; label: string; instruction: string }[] = [
  { id: "shorter", label: "더 짧게", instruction: "본문을 지금보다 확실히 짧게, 핵심만 남겨 주세요." },
  { id: "softer", label: "더 부드럽게", instruction: "본문 어조를 더 부드럽고 친근하게 다듬어 주세요." },
  { id: "numbers", label: "숫자 강조", instruction: "본문에 구체적인 숫자를 앞세워 강조해 주세요." },
  { id: "cta", label: "행동 유도 추가", instruction: "본문 끝에 자연스러운 행동 유도 문장을 한 줄 더해 주세요." },
];

export function refineInstruction(id: RefineId): string {
  return REFINE_PRESETS.find((r) => r.id === id)?.instruction ?? "";
}
