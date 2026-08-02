// 3안 비교(1c) 의 "3안이 다른 점" 표와 자동저장 라벨을 만드는 순수 함수들.
// 표에 들어가는 값은 전부 실제로 아는 것만 쓴다 — 훅은 생성 응답이 알려준 것, 글자 수는 본문에서 센 것.
// proofPointsCited 는 boolean 이라 "어떤 근거를 썼는지"까지는 모른다. 아는 만큼만 적는다.

import type { CopyHook } from "@entities/creative/options";

const OPENING: Record<CopyHook, string> = {
  trendy: "유행 언급으로 관심 끌기",
  story: "고민 공감으로 시작",
  surprise: "의외의 후기로 시작",
  benefit: "얻는 변화를 먼저 말하기",
  trust: "근거와 후기로 믿음 주기",
  number: "구체적인 숫자로 열기",
  rush: "지금 해야 할 이유로 열기",
  unique: "다른 점을 먼저 보여주기",
};

const STYLE_WORD: Record<CopyHook, string> = {
  trendy: "짧고 빠름",
  story: "설명형",
  surprise: "대화체",
  benefit: "약속형",
  trust: "근거형",
  number: "수치형",
  rush: "재촉형",
  unique: "대비형",
};

export function openingStyle(hook: CopyHook | null | undefined): string {
  return hook ? OPENING[hook] : "—";
}

/** "141자 · 짧고 빠름" — 글자 수는 실측, 성격은 이 변형에 실제 적용된 훅에서. */
export function lengthNote(text: string | null | undefined, hook: CopyHook | null | undefined): string {
  const len = (text ?? "").length;
  if (len === 0) return "—";
  return hook ? `${len}자 · ${STYLE_WORD[hook]}` : `${len}자`;
}

/** 근거 인용 여부. 생성기가 알려주지 않았으면(undefined) 단정하지 않는다. */
export function evidenceNote(cited: boolean | undefined): string {
  if (cited === undefined) return "확인 안 됨";
  return cited ? "근거 자료 인용됨" : "근거 인용 없음";
}

/** 자동 저장 pill 문구. 아직 저장 전이면 null → pill 을 아예 그리지 않는다. */
export function savedAgoLabel(savedAt: number | null, now: number): string | null {
  if (!savedAt) return null;
  const mins = Math.floor((now - savedAt) / 60000);
  if (mins < 1) return "자동 저장됨 · 방금";
  if (mins < 60) return `자동 저장됨 · ${mins}분 전`;
  return `자동 저장됨 · ${Math.floor(mins / 60)}시간 전`;
}
