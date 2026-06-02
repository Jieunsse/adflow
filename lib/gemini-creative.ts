// Server-side only — do not import from 'use client' components; GOOGLE_AI_API_KEY would be exposed.

import { generateGeminiText, isGeminiConfigured } from "./gemini-client";
import {
  type ToneId,
  TONE_PROMPT_DESC,
  OBJECTIVES_ALL,
  type ObjectiveId,
  type CopyHook,
  findHook,
  recommendedHooks,
} from "@entities/creative/options";

function toneText(tone: string): string {
  return TONE_PROMPT_DESC[tone as ToneId] ?? tone;
}
import { AD_COPYWRITER_SYSTEM_PROMPT } from "@/lib/prompts/ad-copywriter";
import type { SopSection } from "@features/sop/model/useSopStorage";

export interface BrandProfileContext {
  brandDescription?: string;
  brandVoice?: string;
  customerVoiceSummary?: string;
  policy?: SopSection[];
  copyReferences?: string[];
  /** 근거 자료 (ADR-031) — 성과·사회적 증거 수치의 유일한 출처. */
  proofPoints?: string[];
}

export interface PersonaContext {
  name: string;
  customerDescription?: string;
  interests?: string[];
}

export interface ProductContext {
  name: string;
  description: string;
  price?: string;
}

export interface GenerateCreativeParams {
  brand: string;
  target?: string;
  tone: string;
  outcome: ObjectiveId;
  hint?: string;
  brandProfile?: BrandProfileContext;
  persona?: PersonaContext;
  product?: ProductContext;
  /** 본문 변형 3개에 각각 적용할 카피 훅. 미지정 시 outcome 추천 풀 사용. */
  hooks?: CopyHook[];
  /** ADR-039 — A/B 토너먼트 챌린저 변형 폭. 텍스트 축 한정, 미지정 시 moderate(특수 지시 없음). */
  variationIntensity?: "subtle" | "moderate" | "bold";
}

// ADR-039 — 변형 폭 → 생성 지시 매핑. moderate 는 기존 동작(특수 지시 없음).
const VARIATION_INSTRUCTION: Record<string, string> = {
  subtle:
    "\n변형 폭(살짝): 기존 메시지의 핵심 약속·톤은 유지하고, 표현과 어휘만 미세하게 다듬은 안으로 작성하세요.",
  bold:
    "\n변형 폭(확): 기존과 또렷이 구별되는 과감한 안으로 — 다른 설득 각도·다른 헤드라인 구조·다른 강조점으로 크게 차별화하세요.",
};

// 변형당 1훅 (ADR-029) — 지정값 3개면 그대로, 아니면 outcome 추천 풀.
function resolveHooks(p: GenerateCreativeParams): [CopyHook, CopyHook, CopyHook] {
  if (p.hooks && p.hooks.length === 3) return [p.hooks[0], p.hooks[1], p.hooks[2]];
  return recommendedHooks(p.outcome);
}

// Meta spec: 1=male, 2=female, [] = all (unspecified)
export interface ExtractedTargeting {
  ageMin: number;
  ageMax: number;
  genders: number[];
}

export interface GenerateCreativeResult {
  headlines: [string, string, string];
  primaryTexts: [string, string, string];
  targeting: ExtractedTargeting;
  /** 각 primaryText 변형에 적용된 카피 훅 (배지 표시용). */
  hooks: [CopyHook, CopyHook, CopyHook];
  /** ADR-031 — 근거 자료 수치를 인용한 변형 표시 (`근거 ✓`). 근거 자료에 수치가 없으면 undefined. */
  proofPointsCited?: [boolean, boolean, boolean];
}

const AGE_FLOOR = 18;
const AGE_CEIL = 65;

function sanitizeTargeting(raw: unknown): ExtractedTargeting {
  const t = (raw ?? {}) as {
    ageMin?: unknown;
    ageMax?: unknown;
    genders?: unknown;
  };
  let ageMin = Math.round(Number(t.ageMin));
  let ageMax = Math.round(Number(t.ageMax));
  if (!Number.isFinite(ageMin)) ageMin = AGE_FLOOR;
  if (!Number.isFinite(ageMax)) ageMax = AGE_CEIL;
  ageMin = Math.max(AGE_FLOOR, Math.min(AGE_CEIL, ageMin));
  ageMax = Math.max(AGE_FLOOR, Math.min(AGE_CEIL, ageMax));
  if (ageMin >= ageMax) {
    ageMin = AGE_FLOOR;
    ageMax = AGE_CEIL;
  }
  const list = Array.isArray(t.genders)
    ? t.genders.map(Number).filter((g) => g === 1 || g === 2)
    : [];
  const uniq = Array.from(new Set(list));
  // [1,2] is equivalent to "all" — normalise to []
  return { ageMin, ageMax, genders: uniq.length === 2 ? [] : uniq };
}

function buildPolicyLines(bp: BrandProfileContext): string {
  const policyProhibited = bp.policy
    ?.find((s): s is Extract<SopSection, { type: "prohibited_words" }> => s.type === "prohibited_words")
    ?.data.words.join(", ") ?? "";
  const prohibitedLine = policyProhibited ? `\n금지어 (절대 사용 금지): ${policyProhibited}` : "";

  const lengthSection = bp.policy?.find(
    (s): s is Extract<SopSection, { type: "length_limits" }> => s.type === "length_limits",
  );
  let lengthLine = "";
  if (lengthSection) {
    const parts: string[] = [];
    if (lengthSection.data.headline != null) parts.push(`헤드라인 ${lengthSection.data.headline}자 이내`);
    if (lengthSection.data.body != null) parts.push(`본문 ${lengthSection.data.body}자 이내`);
    if (lengthSection.data.hashtagCount != null) parts.push(`해시태그 ${lengthSection.data.hashtagCount}개 이내`);
    if (parts.length) lengthLine = `\n글자 제한: ${parts.join(", ")}`;
  }

  const ctaSection = bp.policy?.find(
    (s): s is Extract<SopSection, { type: "cta_restrictions" }> => s.type === "cta_restrictions",
  );
  let ctaLine = "";
  if (ctaSection) {
    const parts: string[] = [];
    if (ctaSection.data.blacklist.length) parts.push(`금지 CTA: ${ctaSection.data.blacklist.join(", ")}`);
    if (ctaSection.data.note?.trim()) parts.push(ctaSection.data.note.trim());
    if (parts.length) ctaLine = `\nCTA 제한: ${parts.join(" / ")}`;
  }

  const requiredPhrases = bp.policy
    ?.find((s): s is Extract<SopSection, { type: "required_phrases" }> => s.type === "required_phrases")
    ?.data.phrases ?? [];
  const requiredPhrasesLine = requiredPhrases.length ? `\n반드시 포함할 문구: ${requiredPhrases.join(", ")}` : "";

  const requiredHashtags = bp.policy
    ?.find((s): s is Extract<SopSection, { type: "required_hashtags" }> => s.type === "required_hashtags")
    ?.data.hashtags ?? [];
  const requiredHashtagsLine = requiredHashtags.length ? `\n필수 해시태그 (Instagram): ${requiredHashtags.join(" ")}` : "";

  return prohibitedLine + lengthLine + ctaLine + requiredPhrasesLine + requiredHashtagsLine;
}

export function buildCreativePrompt(p: GenerateCreativeParams): string {
  const outcomeDef = OBJECTIVES_ALL.find((o) => o.id === p.outcome)!;
  const hintLine = p.hint?.trim() ? `\n추가 요청: ${p.hint.trim()}` : "";
  const bp = p.brandProfile;

  const brandLine = bp?.brandDescription?.trim() ?? p.brand;
  const brandVoiceLine = bp?.brandVoice?.trim() ? `\n브랜드 보이스: ${bp.brandVoice.trim()}` : "";
  const productLine = p.product
    ? `\n제품: ${p.product.name} — ${p.product.description}${p.product.price ? ` (가격 참고: ${p.product.price})` : ""}`
    : "";

  const audienceLine = p.persona?.customerDescription?.trim() || p.target?.trim() || p.persona?.name || "";
  const customerVoiceLine = bp?.customerVoiceSummary?.trim() ? `\n고객 언어: ${bp.customerVoiceSummary.trim()}` : "";
  const personaInterestsLine = p.persona?.interests?.length
    ? `\n관심 키워드: ${p.persona.interests.join(", ")}`
    : "";

  const policyLines = bp ? buildPolicyLines(bp) : "";

  const proofPoints = bp?.proofPoints?.filter((t) => t.trim());
  const proofPointLines = proofPoints?.length
    ? `\n\n근거 자료 (검증된 성과·사회적 증거 — 카피에 성과·판매·별점·효과% 등 수치를 넣을 땐 반드시 아래에서만 인용하고, 여기 없는 수치는 지어내지 마세요. 가능하면 한 변형 이상에서 자연스럽게 활용하세요):\n${proofPoints.map((t) => `- ${t.trim()}`).join("\n")}`
    : "";

  const refs = bp?.copyReferences?.filter((t) => t.trim());
  const copyRefLines = refs?.length
    ? `\n\n아래 카피들의 문체와 톤을 참고해서 작성해주세요:\n${refs.map((t, i) => `예시${i + 1}: ${t}`).join("\n")}`
    : "";

  const variationLine = p.variationIntensity ? VARIATION_INSTRUCTION[p.variationIntensity] ?? "" : "";

  const [h0, h1, h2] = resolveHooks(p).map(findHook);
  const hookLines =
    `\n카피 훅: 본문 3개를 각각 아래 설득 각도로 작성하세요. 각도가 본문마다 또렷이 달라야 해요.` +
    `\n  - 본문1 = ${h0.label}(${h0.ko}): ${h0.promptDesc}` +
    `\n  - 본문2 = ${h1.label}(${h1.ko}): ${h1.promptDesc}` +
    `\n  - 본문3 = ${h2.label}(${h2.ko}): ${h2.promptDesc}`;

  return `
아래 정보를 바탕으로 Facebook/Instagram 광고 소재를 작성해주세요.

브랜드: ${brandLine}${brandVoiceLine}${productLine}
타겟 오디언스: ${audienceLine}${customerVoiceLine}${personaInterestsLine}
톤앤매너: ${toneText(p.tone)}
원하는 결과: ${outcomeDef.outcomeLabel} (Meta ${outcomeDef.metaObjective})
카피 방향: ${outcomeDef.copyTone}${variationLine}${hookLines}${hintLine}${policyLines}${proofPointLines}${copyRefLines}

다음 JSON 형식으로 응답하세요:
{
  "headlines": ["헤드라인1 (25자 이내)", "헤드라인2 (25자 이내)", "헤드라인3 (25자 이내)"],
  "primaryTexts": [
    "본문1 — ${h0.label} 훅 (150~200자, 공감→문제→해결→증거→CTA 구조)",
    "본문2 — ${h1.label} 훅 (150~200자)",
    "본문3 — ${h2.label} 훅 (150~200자)"
  ],
  "targeting": {
    "ageMin": 최소연령(18~65 정수),
    "ageMax": 최대연령(18~65 정수),
    "genders": 특정성별이면 [1](남) 또는 [2](여), 아니면 []
  }
}
`.trim();
}


// CJK Unified Ideographs 범위(U+4E00–U+9FFF)의 한자를 제거해요.
function stripHanja(text: string): string {
  return text.replace(/[一-鿿]/g, "");
}

// 본문에 이모지가 하나도 없으면 1개를 보강해요 (프롬프트 정책 폴백, 최소 1개 보장).
function ensureEmoji(text: string): string {
  if (/\p{Extended_Pictographic}/u.test(text)) return text;
  return `${text.replace(/\s+$/, "")} ✨`;
}

// ADR-031 검증 — 근거 자료에서 성과 수치 토큰을 뽑아요 (재구매율 73%, 누적 12만 개 …).
// 단일 자릿수(0종·3개)는 흔한 일반어와 충돌해 false-positive 가 많으므로 제외:
// 2자리 이상이거나 단위(%·만·점 등)가 붙은 토큰만 인용 판정 대상으로 둬요.
const PROOF_NUM_RE = /\d[\d,]*(?:\.\d+)?\s*(?:%|퍼센트|만|천|억|개|원|점|위|년|회|명|배)?/g;

function proofNumericTokens(proofPoints: string[]): string[] {
  const out = new Set<string>();
  for (const pp of proofPoints) {
    for (const m of pp.match(PROOF_NUM_RE) ?? []) {
      const t = m.replace(/\s+/g, "");
      if (/\d/.test(t) && (t.length >= 2 || /\D/.test(t))) out.add(t);
    }
  }
  return [...out];
}


export interface SuggestImageConceptsParams {
  headline: string;
  primaryText: string;
  tone: string;
  // 선택 — Concept 분기 품질 향상용 맥락
  productName?: string;
  productDescription?: string;
  outcome?: string;
  // ADR-041 — true 면 Product Staging 모드: 제품 외형을 묘사하지 않고
  // "보존된 제품을 어떤 배경·상황·조명에 놓을지"(씬 연출)만 변주.
  stageProduct?: boolean;
}

export interface ImageConcept {
  label: string; // 카드 제목 — 예: "스튜디오 · 클로즈업 · 파스텔"
  prompt: string; // 영어 생성 프롬프트
}

export interface SuggestImageConceptsResult {
  concepts: ImageConcept[]; // 3개, 다축 분기
}

const IMAGE_CONCEPTS_TEMPLATE = (p: SuggestImageConceptsParams) =>
  `
당신은 AI 이미지 생성 전문가입니다.
아래 Facebook/Instagram 광고 카피에 어울리는, 서로 또렷이 구별되는 이미지 컨셉 3개를 제안해주세요.
세 컨셉은 배경·연출·앵글·색감 중 여러 축에서 달라야 합니다 (세 장이 같은 배경·같은 무드면 안 됩니다).

광고 헤드라인: ${p.headline}
광고 본문: ${p.primaryText}
톤앤매너: ${toneText(p.tone)}${p.productName ? `\n제품명: ${p.productName}` : ""}${p.productDescription ? `\n제품 설명: ${p.productDescription}` : ""}${p.outcome ? `\n광고 목표: ${p.outcome}` : ""}

${
  p.stageProduct
    ? `가장 중요한 규칙 — 제품 연출(Product Staging):
- 실제 제품 사진이 생성 이미지에 그대로 들어갑니다. 제품의 외형(형태·용기·패키지·라벨·색)을 **절대 묘사하지 마세요** — 제품은 이미 정해져 있어요.
- 세 컨셉은 그 제품을 "어떤 배경·상황·조명·배치로 놓을지"(씬)만 변주합니다.
- 각 prompt는 제품을 놓을 **배경 장면만** 영어로 묘사하세요 (예: "on a marble kitchen counter with soft morning light", "on a beach blanket by the sea at sunset"). 제품 자체는 언급하지 마세요.
- 세 장면이 배경·상황·조명·앵글에서 또렷이 달라야 합니다.`
    : `가장 중요한 규칙 — 제품 일관성:
- 세 컨셉 모두 **똑같은 하나의 제품**을 찍은 것처럼 보여야 합니다. 같은 제품을 서로 다른 장면에서 촬영한 광고 시리즈입니다.
- 제품의 형태·용기 타입·패키지·색은 세 prompt에서 완전히 동일하게 묘사하세요 (예: 한 장은 병(bottle), 다른 장은 통(jar) 처럼 용기를 바꾸면 안 됩니다).
- 모든 prompt에서 제품을 같은 영어 명사구로 지칭하세요. 제품명·설명이 주어졌으면 그 형태(병/튜브/통/파우치 등)를 따르고, 없으면 한 형태를 정해 세 장 모두에 똑같이 사용하세요.
- 달라지는 것은 배경·연출·앵글·조명·색감뿐입니다.`
}

각 컨셉 규칙:
- label: 한국어 짧은 제목으로 컨셉을 요약 (예: "스튜디오 · 클로즈업 · 파스텔")
- prompt: 영어 이미지 생성 프롬프트 (1:1 정사각형 구도, 이미지 안에 텍스트·로고·글자 없는 클린 비주얼, 100단어 이내)
- **label 과 prompt 는 반드시 같은 장면이어야 합니다 (가장 흔히 틀리는 부분).** label 에 "야외/실외/아웃도어"가 들어가면 prompt 에 **반드시 명시적인 실외 장소 영어 단어**를 포함하세요 (예: outdoors, outdoor garden, backyard, park, beach, terrace, balcony, rooftop, poolside, in nature) — "bathroom", "shelf", "indoor", "room", "kitchen counter", "studio" 같은 실내 단어를 쓰면 절대 안 됩니다. label 이 "실내/스튜디오"면 prompt 도 그에 맞는 실내여야 합니다. label 의 장소·시간·분위기가 prompt 에 그대로 드러나야 합니다.
- **세 컨셉은 환경과 앵글을 골고루 섞어 서로 또렷이 달라야 합니다:**
  · 환경 — 세 장을 각각 다른 환경으로 배정하세요: ①또렷한 실외(정원·발코니·공원·해변·테라스 등) ②**연출된 스튜디오** — 제품이 실제 받침대·플랫폼·표면(예: podium, marble slab, draped fabric) 위에 놓이고, 부드러운 방향성 조명으로 은은한 그림자·반사가 있는 스튜디오 제품 촬영컷. seamless 배경에 soft color gradient 나 작은 소품 1~2개를 둬 깊이감을 주세요. ③실내 생활공간(거실·주방·욕실 선반 등). 셋이 같은 환경(특히 셋 다 실내)으로 몰리면 안 됩니다.
  · 앵글/구도 — 세 장의 촬영 앵글도 서로 다르게 섞으세요: 예) 하나는 클로즈업(close-up), 하나는 탑다운 플랫레이(top-down flat lay), 하나는 와이드/아이레벨(wide eye-level shot).
  · label 에 환경·앵글이 드러나게 지으세요 (예: "야외 · 와이드 · 골든아워", "스튜디오 · 클로즈업 · 파스텔", "실내 · 탑다운 · 그린").
- **모든 컷은 제품이 실제 표면·공간 안에 놓인 연출 사진이어야 합니다.** 배경 없이 떠 있는 컷아웃/누끼 느낌은 금지 — "solid/plain white background", "no background", "no shadow", "no distracting elements" 처럼 배경·그림자를 없애는 표현을 쓰지 말고, 항상 받침면·조명·은은한 그림자/반사가 있는 장면으로 묘사하세요. (스튜디오 컷도 미니멀하되 비어있지 않게.)

다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요:
{"concepts": [{"label": "...", "prompt": "..."}, {"label": "...", "prompt": "..."}, {"label": "...", "prompt": "..."}]}
`.trim();

// AI 응답 텍스트 → 검증된 Concept 3개. label·prompt 둘 다 있는 것만 채택, 3개 미만이면 throw.
export function parseImageConcepts(text: string): SuggestImageConceptsResult {
  let parsed: { concepts?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
  }
  const raw = Array.isArray(parsed.concepts) ? parsed.concepts : [];
  const concepts = raw
    .map((c) => {
      const o = (c ?? {}) as { label?: unknown; prompt?: unknown };
      return {
        label: typeof o.label === "string" ? stripHanja(o.label).trim() : "",
        prompt: typeof o.prompt === "string" ? o.prompt.trim() : "",
      };
    })
    .filter((c) => c.label && c.prompt);
  if (concepts.length < 3) {
    throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
  }
  return { concepts: concepts.slice(0, 3) };
}

export const geminiCreative = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async generate(
    params: GenerateCreativeParams,
  ): Promise<GenerateCreativeResult> {
    const prompt = buildCreativePrompt(params);

    const runOnce = async (): Promise<GenerateCreativeResult> => {
      const text = await generateGeminiText(prompt, {
        systemInstruction: AD_COPYWRITER_SYSTEM_PROMPT,
        json: true,
      });

      let parsed: {
        headlines: string[];
        primaryTexts: string[];
        targeting?: unknown;
      };
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("AI 응답을 파싱할 수 없어요. 다시 시도해주세요.");
      }

      if (
        !Array.isArray(parsed.headlines) ||
        parsed.headlines.length < 3 ||
        parsed.headlines
          .slice(0, 3)
          .some((h: unknown) => typeof h !== "string" || !h) ||
        !Array.isArray(parsed.primaryTexts) ||
        parsed.primaryTexts.length < 3 ||
        parsed.primaryTexts
          .slice(0, 3)
          .some((t: unknown) => typeof t !== "string" || !t)
      ) {
        throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
      }

      return {
        headlines: [
          stripHanja(parsed.headlines[0]),
          stripHanja(parsed.headlines[1]),
          stripHanja(parsed.headlines[2]),
        ],
        primaryTexts: [
          ensureEmoji(stripHanja(parsed.primaryTexts[0])),
          ensureEmoji(stripHanja(parsed.primaryTexts[1])),
          ensureEmoji(stripHanja(parsed.primaryTexts[2])),
        ],
        targeting: sanitizeTargeting(parsed.targeting),
        // 훅은 우리가 변형에 배정한 값이 진실원 — 모델 echo 에 의존하지 않음 (ADR-029).
        hooks: resolveHooks(params),
      };
    };

    let result = await runOnce();

    // ADR-031 — 근거 자료에 성과 수치가 있는데 어떤 변형도 인용 안 하면 1회만 재생성.
    // 근거가 없거나 수치가 없으면 강제하지 않음(없는 수치를 만들라는 압박 = 지어내기 회귀).
    const tokens = proofNumericTokens(
      params.brandProfile?.proofPoints?.filter((p) => p.trim()) ?? [],
    );
    if (tokens.length) {
      const cited = (r: GenerateCreativeResult) =>
        r.primaryTexts.map((t) => {
          const norm = t.replace(/\s+/g, "");
          return tokens.some((tok) => norm.includes(tok));
        }) as [boolean, boolean, boolean];

      let flags = cited(result);
      if (!flags.some(Boolean)) {
        result = await runOnce();
        flags = cited(result);
      }
      result.proofPointsCited = flags;
    }

    return result;
  },

  async suggestImageConcepts(
    params: SuggestImageConceptsParams,
  ): Promise<SuggestImageConceptsResult> {
    const prompt = IMAGE_CONCEPTS_TEMPLATE(params);
    const runOnce = async () =>
      parseImageConcepts(
        await generateGeminiText(prompt, {
          systemInstruction: AD_COPYWRITER_SYSTEM_PROMPT,
          json: true,
        }),
      );
    try {
      return await runOnce();
    } catch {
      // JSON 파싱/형식 실패 시 1회만 재시도.
      return await runOnce();
    }
  },
};
