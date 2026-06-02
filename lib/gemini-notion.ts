// Server-side only — Notion 추출 텍스트 → Brand Profile 스타일 필드 매핑 (ADR-043).
// 정책(SopSection[])은 geminiSop.deriveFromMarketing 재사용. 여기는 스타일5필드+proofPoints 전담.
import { generateGeminiText, isGeminiConfigured } from "./gemini-client";

export interface BrandProfileFields {
  tone?: string;
  brandDescription?: string;
  brandVoice?: string;
  customerVoiceSummary?: string;
  imageGuide?: string;
  proofPoints: string[];
}

const STYLE_FIELDS = ["tone", "brandDescription", "brandVoice", "customerVoiceSummary", "imageGuide"] as const;

const MAP_PROMPT = (raw: string) =>
  `
당신은 브랜드 자료 분석가예요. 아래 노션에서 가져온 브랜드 자료를 읽고, Brand Profile 의 스타일 필드로 정리해주세요.

각 필드 (해당 정보가 자료에 **명시되어 있을 때만** 채우고, 없으면 빈 문자열):
  - "tone": 광고의 전반적 톤·느낌 (예: 친근하고 유머러스하게)
  - "brandDescription": 제품·서비스 소개, 타겟, 강점 요약
  - "brandVoice": 브랜드가 말하는 방식·어조 가이드
  - "customerVoiceSummary": 고객 리뷰·VOC 요약, 고객이 쓰는 언어
  - "imageGuide": 이미지 분위기·배경색·로고 위치·인물 정책 등 미감 가이드
  - "proofPoints": 카피에 쓸 수 있는 검증된 성과·사회적 증거 배열 (한 항목에 하나)

proofPoints 규칙 (매우 중요):
  - 자료에 **실제로 적힌 수치·사실만** 그대로 인용 (예: "재구매율 73%", "누적 12만 개 판매", "별점 4.9").
  - 자료에 없는 수치는 **절대 지어내지 마세요.** 추정·반올림·과장 금지.
  - 근거 수치가 전혀 없으면 빈 배열 [].

반드시 아래 JSON 형식으로만 응답 (그 외 텍스트·마크다운 금지):
{
  "tone": "",
  "brandDescription": "",
  "brandVoice": "",
  "customerVoiceSummary": "",
  "imageGuide": "",
  "proofPoints": []
}

--- 브랜드 자료 ---
${raw}
`.trim();

function parseResponse(text: string): BrandProfileFields {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
  }
  const out: BrandProfileFields = { proofPoints: [] };
  for (const f of STYLE_FIELDS) {
    const v = parsed[f];
    if (typeof v === "string" && v.trim().length > 0) out[f] = v.trim();
  }
  if (Array.isArray(parsed.proofPoints)) {
    out.proofPoints = parsed.proofPoints
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map((p) => p.trim());
  }
  return out;
}

export const geminiNotion = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async mapToBrandProfile(raw: string): Promise<BrandProfileFields> {
    const text = await generateGeminiText(MAP_PROMPT(raw), { json: true });
    return parseResponse(text);
  },
};
