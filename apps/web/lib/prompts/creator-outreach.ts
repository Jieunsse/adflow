// PRD-influencer-marketing.md §6 — 협업 제안 메시지 초안 (Gemini). Server-side only.
// ADR-065 §2 — "발송" 아닌 "초안 + 복사". ADR-031 — 입력에 없는 수치(할인율·성과 약속 등) 지어내기 금지.

import { generateGeminiText, isGeminiConfigured } from "@/lib/gemini-client";

export interface OutreachBrandSummary {
  name: string;
  description?: string;
}

export interface OutreachCreator {
  handle: string;
  category: string[];
  platform: string;
}

export interface OutreachCampaign {
  name: string;
  goal: string;
  product?: string;
}

export interface GenerateOutreachParams {
  brand: OutreachBrandSummary;
  creator: OutreachCreator;
  campaign: OutreachCampaign;
}

export interface GenerateOutreachResult {
  message: string;
}

const SYSTEM = `너는 브랜드 마케팅 담당자를 대신해 크리에이터에게 보낼 협업 제안 메시지 초안을 쓰는 카피라이터야.

규칙:
- 정중한 비즈니스 제안 톤(해요체보다 격식 있는 존댓말). 과한 친밀함·이모지 남발 금지.
- 입력에 없는 수치(할인율·비용·성과 약속·팔로워 수 등)를 절대 지어내지 마. 구체적 조건은 "협의를 통해 정하고 싶다"처럼 열어 둬.
- 크리에이터의 handle·category 를 자연스럽게 언급해 맞춤 제안임을 드러내.
- 분량은 5~8문장. 인사 → 브랜드/캠페인 소개 → 협업 제안 이유 → 다음 액션 제안(회신 요청) 순서.
- 이 메시지는 대신 발송되지 않고 마케터가 복사해서 직접 전달할 거야 — 서명·연락처는 넣지 마(마케터가 채울 몫).

출력은 아래 JSON 객체 하나. 코드펜스·설명 없이 JSON 만:
{ "message": "제안 메시지 전문" }`;

function buildPrompt(p: GenerateOutreachParams): string {
  const lines: string[] = [];
  lines.push(`브랜드: ${p.brand.name}`);
  if (p.brand.description?.trim()) lines.push(`브랜드 소개: ${p.brand.description.trim()}`);
  lines.push(`크리에이터: ${p.creator.handle} (${p.creator.platform}, 카테고리: ${p.creator.category.join(", ") || "미지정"})`);
  lines.push(`캠페인: ${p.campaign.name}`);
  lines.push(`캠페인 목표: ${p.campaign.goal}`);
  if (p.campaign.product?.trim()) lines.push(`대상 제품: ${p.campaign.product.trim()}`);
  return lines.join("\n");
}

export function parseOutreach(text: string): GenerateOutreachResult {
  let parsed: { message?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
  }
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
  if (!message) throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
  return { message };
}

export const creatorOutreach = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async generate(params: GenerateOutreachParams): Promise<GenerateOutreachResult> {
    const text = await generateGeminiText(buildPrompt(params), {
      systemInstruction: SYSTEM,
      json: true,
    });
    return parseOutreach(text);
  },
};
