import { TONES, OBJECTIVES_ALL, type ToneId, type ObjectiveId } from "@entities/creative/options";

export interface BriefPromptInput {
  headline: string;
  primaryText: string;
  tone: ToneId;
  outcomeChip: ObjectiveId | null;
  /** Number of scene shots attached (image data is passed separately as referenceImages). */
  scenesCount: number;
  hasLogo: boolean;
  aspect: string;
  notes: string;
}

export function buildBriefPrompt(input: BriefPromptInput): string {
  const toneLabel = TONES.find((t) => t.id === input.tone)?.label ?? input.tone;
  const outcomeDef = input.outcomeChip ? OBJECTIVES_ALL.find((o) => o.id === input.outcomeChip) : null;
  const lines: (string | null)[] = [
    "Facebook/Instagram 광고용 이미지 디자인 의뢰입니다.",
    "",
    "[기획안]",
    `- 헤드라인: ${input.headline}`,
    input.primaryText ? `- 본문 카피: ${input.primaryText}` : null,
    `- 톤앤매너: ${toneLabel}`,
    outcomeDef ? `- 광고 목표: ${outcomeDef.outcomeLabel} — 카피 방향 "${outcomeDef.copyTone}"` : null,
    "",
    "[전달 자료]",
    input.scenesCount > 0
      ? `- 연출컷 ${input.scenesCount}장 (앞쪽 첨부): 카메라 앵글·라이팅·전반 분위기 참고`
      : "- 연출컷: 없음",
    input.hasLogo ? "- 로고 1장 (뒤쪽 첨부): 가능하면 우측 하단에 작게 합성하지 말고 분위기만 참고" : "- 로고: 없음",
    "",
    input.notes.trim() ? `[추가 지시사항]\n${input.notes.trim()}\n` : null,
    "[원하는 결과]",
    `- ${input.aspect} 비율의 1장짜리 광고 이미지`,
    "- 이미지 안에 텍스트·로고·글자 합성 금지 (헤드라인·CTA는 Meta 텍스트 필드로 별도 처리)",
    "- 연출컷의 카메라 톤·라이팅을 따르되, 헤드라인 메시지에 맞춰 새로 구성",
    "- 1:1 정사각형에 잘리지 않게 중심 피사체를 가운데에 배치",
  ];
  return lines.filter((x) => x !== null).join("\n");
}
