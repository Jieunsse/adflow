// Server-side only — do not import from 'use client' components.

import { generateGeminiText, isGeminiConfigured } from "./gemini-client";

export type DraftChannel = "instagram" | "facebook";

export interface GenerateChannelDraftParams {
  channel: DraftChannel;
  suggestionTitle: string;
  suggestionDetail: string[];
}

export interface ChannelDraftResult {
  caption: string;
  hashtags: string[]; // FB 의 경우 빈 배열
  imagePrompt: string;
}

function stripHanja(text: string): string {
  return text.replace(/[一-鿿]/g, "");
}

const PROMPT = (p: GenerateChannelDraftParams) => {
  const channelKr = p.channel === "instagram" ? "인스타그램" : "페이스북 페이지";
  const hashtagRule = p.channel === "instagram"
    ? `"hashtags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5"]  (3~5개, # 포함, 한글/영문 가능)`
    : `"hashtags": []  (페이스북은 해시태그 무의미 — 빈 배열)`;
  return `
당신은 한국 시장 SNS 콘텐츠 카피라이터예요. 아래 채널 인사이트 제안을 바탕으로 ${channelKr} 오가닉 포스트 초안을 만들어주세요.

제안 제목: ${p.suggestionTitle}
제안 내용:
${p.suggestionDetail.map((l) => `- ${l}`).join("\n")}

요구사항:
- 캡션: 한국어, 자연스러운 구어체. ${p.channel === "instagram" ? "150~250자" : "120~200자"} 권장.
- 캡션 안에 이모지 1~3개 자연스럽게 섞기 (과하지 않게).
- 캡션은 _완성된 포스트 본문_ 이어야 함 — "이런 콘텐츠를 만드세요" 가 아니라 실제로 올릴 수 있는 글.
- 이미지 프롬프트: 영어, 100단어 이내. 1:1 정사각형, 이미지 안에 텍스트·로고 X.

다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "caption": "포스트 본문 (한국어)",
  ${hashtagRule},
  "imagePrompt": "image generation prompt (English, <100 words)"
}
`.trim();
};

export const geminiChannelDraft = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async generate(params: GenerateChannelDraftParams): Promise<ChannelDraftResult> {
    const text = await generateGeminiText(PROMPT(params), { json: true });

    let parsed: { caption?: unknown; hashtags?: unknown; imagePrompt?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
    }

    const caption = typeof parsed.caption === "string" ? stripHanja(parsed.caption).trim() : "";
    const imagePrompt = typeof parsed.imagePrompt === "string" ? parsed.imagePrompt.trim() : "";
    const rawTags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    const hashtags = params.channel === "facebook"
      ? []
      : rawTags
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => (t.startsWith("#") ? t.trim() : `#${t.trim()}`))
          .slice(0, 5);

    if (!caption || !imagePrompt) {
      throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
    }

    return { caption, hashtags, imagePrompt };
  },
};
