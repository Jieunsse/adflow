// Server-side only — do not import from 'use client' components.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { OBJECTIVES_PHASE1, type ObjectiveId } from "@entities/creative/options";

const PHASE1_IDS = OBJECTIVES_PHASE1.map((o) => o.id);

export interface SuggestCampaignParams {
  brandDescription?: string;
  brandVoice?: string;
  tone?: string;
  recentObjectives?: string[]; // recent past campaign goal IDs
}

export interface CampaignSuggestion {
  objectiveId: ObjectiveId;
  title: string;   // AI-suggested campaign concept (1줄)
  reason: string;  // why this campaign makes sense now (한 문장)
}

export interface SuggestCampaignResult {
  suggestions: [CampaignSuggestion, CampaignSuggestion, CampaignSuggestion];
}

const isConfigured = !!process.env.GOOGLE_AI_API_KEY;

async function suggest(params: SuggestCampaignParams): Promise<SuggestCampaignResult> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY 가 설정되지 않았어요.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const brandCtx = [
    params.brandDescription && `브랜드 설명: ${params.brandDescription}`,
    params.brandVoice && `브랜드 보이스: ${params.brandVoice}`,
    params.tone && `선호 톤: ${params.tone}`,
    params.recentObjectives?.length
      ? `최근 집행한 광고 목표: ${params.recentObjectives.join(", ")}`
      : "광고 집행 이력 없음",
  ]
    .filter(Boolean)
    .join("\n");

  const objectiveList = OBJECTIVES_PHASE1.map(
    (o) => `- ${o.id}: ${o.outcomeLabel} (${o.copyTone})`
  ).join("\n");

  const prompt = `
당신은 Meta 광고 전략가입니다.
아래 계정 현황을 보고, 지금 당장 집행하기 좋은 다음 광고 캠페인 3개를 추천해 주세요.

[계정 현황]
${brandCtx || "브랜드 정보 없음"}

[선택 가능한 광고 목표 목록]
${objectiveList}

[규칙]
1. 반드시 서로 다른 3개의 objectiveId 를 선택하세요. 같은 id 반복 금지.
2. objectiveId 는 위 목록의 id 값 그대로 사용하세요.
3. title 은 15자 이내 캠페인 컨셉 한 줄 (예: "신제품 런칭 인지도 광고").
4. reason 은 "왜 지금 이 목표인지" 한 문장·40자 이내, 계정 현황을 근거로 작성하세요.
5. 최근 집행 이력이 있으면 겹치지 않는 목표를 우선 추천하세요.
6. 이력이 없으면 awareness, traffic, engagement 를 우선 추천하세요.

아래 JSON 형식으로만 응답하세요:
{
  "suggestions": [
    { "objectiveId": "...", "title": "...", "reason": "..." },
    { "objectiveId": "...", "title": "...", "reason": "..." },
    { "objectiveId": "...", "title": "...", "reason": "..." }
  ]
}`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini 응답을 파싱할 수 없어요.");

  const parsed = JSON.parse(jsonMatch[0]) as {
    suggestions: Array<{ objectiveId: string; title: string; reason: string }>;
  };

  if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length < 3) {
    throw new Error("제안이 3개 미만이에요.");
  }

  const suggestions = parsed.suggestions.slice(0, 3).map((s) => ({
    objectiveId: ((PHASE1_IDS as readonly string[]).includes(s.objectiveId)
      ? s.objectiveId
      : "traffic") as ObjectiveId,
    title: String(s.title ?? "").slice(0, 30),
    reason: String(s.reason ?? "").slice(0, 200),
  })) as [CampaignSuggestion, CampaignSuggestion, CampaignSuggestion];

  return { suggestions };
}

export const geminiSuggestCampaign = { isConfigured, suggest };
