// Server-side only — do not import from 'use client' components; GOOGLE_AI_API_KEY would be exposed.

import { GoogleGenerativeAI } from "@google/generative-ai";

export type SopType =
  | "prohibited_words"
  | "length_limits"
  | "cta_restrictions"
  | "industry_regulations"
  | "competitor_policy"
  | "pricing_rules"
  | "audience_restrictions"
  | "platform_rules";

const SOP_TYPE_LABEL: Record<SopType, string> = {
  prohibited_words: "금지어 (법·규제·정책상 사용 불가 단어)",
  length_limits: "글자수·길이 제한",
  cta_restrictions: "CTA 제한 (금지된 행동 유도 문구)",
  industry_regulations: "업종 규제 (의료·금융·식품 등 필수 면책)",
  competitor_policy: "경쟁사 언급 정책",
  pricing_rules: "가격 표시 규칙",
  audience_restrictions: "타겟 오디언스 제한 (연령·지역 등)",
  platform_rules: "플랫폼별 정책 (Meta·IG·FB 비율·길이 등)",
};

export type BrandProfileField = "brandVoice" | "requiredPhrases" | "imageGuide" | "requiredHashtags";

export interface BrandProfileCandidate {
  field: BrandProfileField;
  content: string;
}

export type ClassifiedSection =
  | { type: "prohibited_words"; data: { words: string[] } }
  | { type: "length_limits"; data: { headline?: number; body?: number; link?: number; hashtagCount?: number } }
  | { type: "cta_restrictions"; data: { blacklist: string[]; note?: string } }
  | {
      type:
        | "industry_regulations"
        | "competitor_policy"
        | "pricing_rules"
        | "audience_restrictions"
        | "platform_rules";
      data: { text: string };
    };

export interface ClassifyResult {
  sections: ClassifiedSection[];
  brandProfileCandidates: BrandProfileCandidate[];
  droppedTypes: SopType[];
}

export interface ClassifyParams {
  raw: string;
}

export interface DeriveParams {
  raw: string;
}

export interface SectionSuggestParams {
  type: SopType;
  industry?: string;
}

export interface SectionSuggestResult {
  examples: string[];
}

const TEXT_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} 가 .env.local 에 설정되지 않았어요.`);
  return v;
}

function is503(err: unknown): boolean {
  return err instanceof Error && err.message.includes("503");
}

async function generateWithFallback(apiKey: string, prompt: string): Promise<string> {
  for (const modelName of TEXT_MODELS) {
    try {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (is503(err) && modelName !== TEXT_MODELS[TEXT_MODELS.length - 1]) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
  throw new Error("모든 AI 모델이 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요.");
}

const TYPE_LIST = (Object.entries(SOP_TYPE_LABEL) as [SopType, string][])
  .map(([k, v]) => `  - "${k}": ${v}`)
  .join("\n");

const BRAND_PROFILE_HINT = `
Brand Profile 영역 (가드레일이 아닌 브랜드 표현 — SOP 에 잘못 들어오면 안 됨):
  - "brandVoice": 브랜드 톤·어조·말투
  - "requiredPhrases": 광고에 반드시 포함해야 하는 문구
  - "imageGuide": 이미지 가이드 (배경·로고 위치·색상 톤)
  - "requiredHashtags": 필수 해시태그
`.trim();

const SCHEMA_HINT = `
section 의 type 별 data 형식 (반드시 준수):
  - prohibited_words: { "words": string[] } — 금지 단어/문구 배열
  - length_limits: { "headline"?: number, "body"?: number, "link"?: number, "hashtagCount"?: number } — 정의된 필드만 포함, 모두 정수
  - cta_restrictions: { "blacklist": string[], "note"?: string } — 금지 CTA 문구 배열 + 선택 메모
  - industry_regulations, competitor_policy, pricing_rules, audience_restrictions, platform_rules: { "text": string } — 한 줄에 한 룰씩, 줄바꿈으로 구분
`.trim();

const CLASSIFY_PROMPT = (raw: string) =>
  `
당신은 광고 SOP (Standard Operating Procedure — 가드레일 / "하지 말 것") 분류 전문가예요.
아래 줄글로 작성된 사내 SOP 를 8 type 카테고리로 분류 + 구조화해주세요.

SOP 8 type (가드레일):
${TYPE_LIST}

${BRAND_PROFILE_HINT}

${SCHEMA_HINT}

원본:
"""
${raw}
"""

규칙:
- 같은 type 의 여러 룰은 위 schema 에 맞게 한 entry 로 통합.
- 한국어 원문 표현 보존 (요약·재작성 X). 구조화만.
- 어떤 type 에도 들지 않으면 누락. 억지로 채우지 말 것.
- 가드레일이 아닌 _브랜드 표현_ 은 sections 가 아니라 brandProfileCandidates 로.

다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "sections": [
    { "type": "prohibited_words", "data": { "words": ["..."] } },
    { "type": "length_limits", "data": { "headline": 40 } },
    { "type": "cta_restrictions", "data": { "blacklist": ["..."], "note": "..." } },
    { "type": "industry_regulations", "data": { "text": "..." } }
  ],
  "brandProfileCandidates": [
    { "field": "brandVoice", "content": "감지된 톤 문구" }
  ]
}
`.trim();

const DERIVE_PROMPT = (raw: string) =>
  `
당신은 광고 SOP 가드레일 추출 전문가예요.
아래는 회사의 마케팅 자료 (브랜드북·광고 가이드·회사 소개 등) 입니다.
이 자료에서 _SOP 가드레일 (negative — 하지 말 것)_ 만 추출 + 구조화해주세요.

SOP 8 type (가드레일):
${TYPE_LIST}

${BRAND_PROFILE_HINT}

${SCHEMA_HINT}

원본:
"""
${raw}
"""

규칙:
- _브랜드 표현_ (톤·필수문구·이미지·해시태그) 은 sections 에 넣지 말고 brandProfileCandidates 로.
- 마케팅 자료에 명시된 _제약·금지·규제_ 만 sections.
- 자료 표현을 보존하되 가드레일 형태로 정리.
- 명시적 가드레일이 적으면 적은 대로. 없는 type 은 누락.

응답 JSON 형식은 위 CLASSIFY 와 동일.
`.trim();

const SECTION_SUGGEST_PROMPT = (p: SectionSuggestParams) =>
  `
광고 SOP 가드레일 작성 예시를 3 개 제안해주세요.

type: ${p.type} — ${SOP_TYPE_LABEL[p.type]}
${p.industry ? `업종: ${p.industry}` : ""}

규칙:
- 한국어, 각 예시는 _바로 SOP 에 적을 수 있는 완성된 문장_.
- 짧고 명료하게 (한 줄~두 줄).
- 일반론이 아닌 _구체적 룰_ (예: "최고, 1위 단어 금지" O / "오해 소지 단어 주의" X).

다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{ "examples": ["예시1", "예시2", "예시3"] }
`.trim();

const VALID_TYPES = new Set<SopType>([
  "prohibited_words",
  "length_limits",
  "cta_restrictions",
  "industry_regulations",
  "competitor_policy",
  "pricing_rules",
  "audience_restrictions",
  "platform_rules",
]);

const FREE_TEXT_TYPES = new Set<SopType>([
  "industry_regulations",
  "competitor_policy",
  "pricing_rules",
  "audience_restrictions",
  "platform_rules",
]);

const VALID_BP_FIELDS = new Set<BrandProfileField>([
  "brandVoice",
  "requiredPhrases",
  "imageGuide",
  "requiredHashtags",
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function asPositiveInt(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.floor(v);
}

function validateSection(raw: unknown): ClassifiedSection | null {
  if (!isObj(raw)) return null;
  const type = raw.type;
  if (typeof type !== "string" || !VALID_TYPES.has(type as SopType)) return null;
  const data = raw.data;
  if (!isObj(data)) return null;

  switch (type as SopType) {
    case "prohibited_words": {
      const words = asStringArray(data.words);
      if (!words || words.length === 0) return null;
      return { type: "prohibited_words", data: { words } };
    }
    case "length_limits": {
      const headline = asPositiveInt(data.headline);
      const body = asPositiveInt(data.body);
      const link = asPositiveInt(data.link);
      const hashtagCount = asPositiveInt(data.hashtagCount);
      if (headline == null && body == null && link == null && hashtagCount == null) return null;
      const result: { headline?: number; body?: number; link?: number; hashtagCount?: number } = {};
      if (headline != null) result.headline = headline;
      if (body != null) result.body = body;
      if (link != null) result.link = link;
      if (hashtagCount != null) result.hashtagCount = hashtagCount;
      return { type: "length_limits", data: result };
    }
    case "cta_restrictions": {
      const blacklist = asStringArray(data.blacklist) ?? [];
      const note = typeof data.note === "string" ? data.note.trim() : "";
      if (blacklist.length === 0 && note.length === 0) return null;
      const result: { blacklist: string[]; note?: string } = { blacklist };
      if (note) result.note = note;
      return { type: "cta_restrictions", data: result };
    }
    default: {
      const text = typeof data.text === "string" ? data.text.trim() : "";
      if (!text) return null;
      if (!FREE_TEXT_TYPES.has(type as SopType)) return null;
      return {
        type: type as Extract<ClassifiedSection, { data: { text: string } }>["type"],
        data: { text },
      };
    }
  }
}

function parseClassifyResponse(text: string): ClassifyResult {
  let parsed: { sections?: unknown; brandProfileCandidates?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
  }

  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const sections: ClassifiedSection[] = [];
  const droppedTypes: SopType[] = [];
  const seen = new Set<SopType>();

  for (const raw of rawSections) {
    const validated = validateSection(raw);
    if (validated) {
      if (!seen.has(validated.type)) {
        sections.push(validated);
        seen.add(validated.type);
      }
    } else if (isObj(raw) && typeof raw.type === "string" && VALID_TYPES.has(raw.type as SopType)) {
      const t = raw.type as SopType;
      if (!droppedTypes.includes(t)) droppedTypes.push(t);
    }
  }

  const candidates = Array.isArray(parsed.brandProfileCandidates)
    ? parsed.brandProfileCandidates
        .map((c) => c as { field?: unknown; content?: unknown })
        .filter(
          (c): c is BrandProfileCandidate =>
            typeof c.field === "string" &&
            VALID_BP_FIELDS.has(c.field as BrandProfileField) &&
            typeof c.content === "string" &&
            c.content.trim().length > 0,
        )
        .map((c) => ({ field: c.field, content: c.content.trim() }))
    : [];

  return { sections, brandProfileCandidates: candidates, droppedTypes };
}

export const geminiSop = {
  get isConfigured() {
    return !!process.env.GOOGLE_AI_API_KEY;
  },

  async classify(params: ClassifyParams): Promise<ClassifyResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(apiKey, CLASSIFY_PROMPT(params.raw));
    return parseClassifyResponse(text);
  },

  async deriveFromMarketing(params: DeriveParams): Promise<ClassifyResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(apiKey, DERIVE_PROMPT(params.raw));
    return parseClassifyResponse(text);
  },

  async sectionSuggest(params: SectionSuggestParams): Promise<SectionSuggestResult> {
    const apiKey = requireEnv("GOOGLE_AI_API_KEY");
    const text = await generateWithFallback(apiKey, SECTION_SUGGEST_PROMPT(params));
    let parsed: { examples?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
    }
    const examples = Array.isArray(parsed.examples)
      ? parsed.examples
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
          .map((e) => e.trim())
          .slice(0, 3)
      : [];
    if (examples.length === 0) {
      throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
    }
    return { examples };
  },
};
