// Server-side only — do not import from 'use client' components; GOOGLE_AI_API_KEY would be exposed.

import { GoogleGenAI } from "@google/genai";
import { isGeminiConfigured, requireGeminiKey } from "./gemini-client";

export interface ReferenceImage {
  mimeType: string;
  dataBase64: string; // base64 string without the "data:...;base64," prefix
}

// 생성될 이미지 1장 = variant 1개. prompt 차이가 다양성의 뿌리(Image Concept).
export interface ImageVariant {
  prompt: string;
  referenceImages?: ReferenceImage[]; // variant 전용 (예: brief 의 연출컷)
}

export interface GenerateImageParams {
  variants: ImageVariant[];
  referenceImages?: ReferenceImage[]; // 전 variant 공통 (Package Reference 등)
  // ADR-041 — 공통 referenceImages 의 해석을 가른다.
  //   true(Product Staging): 제품을 원본 보존(라벨 포함), 주변 씬만 생성.
  //   false/생략(brief·기본): 기존 style guide 해석(피사체·구도·색감 근사).
  preserveReference?: boolean;
}

export interface GenerateImageResult {
  images: string[];
}

const DEFAULT_IMAGE_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.5-flash-image",
];

function resolveModels(): string[] {
  const env = process.env.GEMINI_IMAGE_MODEL?.trim();
  if (env)
    return env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return DEFAULT_IMAGE_MODELS;
}

// Remembers the first successful model so subsequent calls skip the 404 fallback round-trip.
// Resets on process restart.
let preferredModel: string | null = null;
const MAX_COUNT = 4;
// 100 ms stagger is enough for 3 concurrent calls without hitting Gemini RPM limits.
const STAGGER_MS = 100;
// 500 ms sleep on first failure/empty-response (includes safety blocks).
const RETRY_DELAY_MS = 500;
const MAX_REFERENCE_IMAGES = 6;

export function sanitizeRefs(raw: unknown): ReferenceImage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const refs = (raw as unknown[])
    .filter((r): r is ReferenceImage =>
      !!r && typeof (r as ReferenceImage).mimeType === "string" && typeof (r as ReferenceImage).dataBase64 === "string",
    )
    .slice(0, MAX_REFERENCE_IMAGES);
  return refs.length ? refs : undefined;
}

// TODO(PRD): fix output aspect ratio to 1:1 via config.imageConfig.aspectRatio once confirmed
//            supported by this SDK version. (Current model default is approximately square.)

const AD_CONTEXT =
  "Generate a high-quality commercial product ad image for a social media campaign. " +
  "Do NOT render any text, letters, words, numbers, logos, watermarks, or brand names anywhere in the image — " +
  "not on the product packaging, label, or background. The product must be clean and unbranded.";
const REF_STYLE_GUIDE =
  "Use the reference image as the primary visual style guide. Keep the subject, composition, and color palette close to the reference.";
// ADR-041 — Product Staging. 레퍼런스 = 실제 제품. 다시 그리지 말고 원본 보존, 주변 씬만 생성.
const PRESERVE_PRODUCT =
  "Generate a high-quality commercial product ad image for a social media campaign. " +
  "The reference image is the ACTUAL product. Preserve the product exactly as shown — keep its real label, logo, text, packaging, shape, and colors completely unchanged. Do NOT redraw, restyle, or remove any branding on the product. " +
  "There must be EXACTLY ONE product in the image — the product from the reference. Do NOT add, draw, duplicate, or invent any other or additional product, bottle, jar, tube, pump, or container. If the scene direction mentions a product, it refers ONLY to this same reference product, never a second one. " +
  "Generate only the surrounding scene around the product. Do NOT add any other text, letters, words, numbers, watermarks, or third-party logos anywhere in the background.";

type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// variant prompt + (공통 + variant 전용) 레퍼런스를 합쳐 한 슬롯의 contents 를 만든다.
// preserve(ADR-041): 레퍼런스가 있을 때만 의미 — 제품 원본 보존 프롬프트로 분기.
export function buildVariantContents(prompt: string, refs: ReferenceImage[], preserve = false): ContentPart[] {
  const hasRefs = refs.length > 0;
  const hasPrompt = !!prompt;

  let text: string;
  if (preserve && hasRefs) {
    text = hasPrompt ? `${PRESERVE_PRODUCT}\nScene direction: ${prompt}` : PRESERVE_PRODUCT;
  } else if (hasRefs && hasPrompt) {
    text = `${AD_CONTEXT}\n${REF_STYLE_GUIDE}\nAdditional creative direction: ${prompt}`;
  } else if (hasRefs) {
    text = `${AD_CONTEXT}\n${REF_STYLE_GUIDE}`;
  } else {
    text = `${AD_CONTEXT}\n${prompt}`;
  }

  // Reference images first to anchor visual style, then the instruction text
  const parts: ContentPart[] = [];
  for (const ref of refs) {
    if (ref?.mimeType && ref?.dataBase64) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.dataBase64 } });
    }
  }
  parts.push({ text });
  return parts;
}

// Returns DataURL on success, null if the response contains no image (text-only / safety block),
// or throws on a hard call failure (429/503/network etc.).
async function attemptGenerate(
  ai: GoogleGenAI,
  contents: ContentPart[],
): Promise<string | null> {
  const list = resolveModels();
  // Try the previously-successful model first to skip the 404 fallback round-trip.
  const ordered =
    preferredModel && list.includes(preferredModel)
      ? [preferredModel, ...list.filter((m) => m !== preferredModel)]
      : list;

  let lastErr: unknown;
  for (const model of ordered) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { responseModalities: ["image", "text"] },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData;
        if (inline?.data) {
          if (preferredModel !== model) preferredModel = model; // 첫 성공 모델 캐싱
          return `data:${inline.mimeType || "image/png"};base64,${inline.data}`;
        }
      }
      // Response arrived but contained no image — retrying on the same model beats alias fallback.
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[gemini-image] model ${model} 실패: ${msg}`);
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("이미지 생성 호출에 실패했어요.");
}

// One slot = one output image. Retries once on failure/empty. On final failure, logs and returns
// null rather than throwing — so the other slots keep running.
async function generateSlot(
  ai: GoogleGenAI,
  contents: ContentPart[],
  slot: number,
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const img = await attemptGenerate(ai, contents);
      if (img) return img;
      if (attempt === 1) {
        console.warn(
          `[gemini-image] slot ${slot}: 응답에 이미지가 없어요 (텍스트만/세이프티 차단 가능) — 재시도`,
        );
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.warn(
        `[gemini-image] slot ${slot}: 재시도해도 이미지가 없어요 — 이 슬롯 포기`,
      );
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 1) {
        console.warn(
          `[gemini-image] slot ${slot}: 1차 호출 실패 (${msg}) — 재시도`,
        );
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.warn(
        `[gemini-image] slot ${slot}: 재시도도 실패 (${msg}) — 이 슬롯 포기`,
      );
      return null;
    }
  }
  return null;
}

interface NormalizedVariant {
  prompt: string;
  referenceImages: ReferenceImage[];
}

// variants[] + 공통 referenceImages 를 정규화한다. variant 가 없거나 전부 (prompt·공통ref·전용ref)
// 무엇도 없으면 throw — SSE/route 에서 400 으로 surface. count 는 MAX_COUNT 로 cap.
export function normalizeVariants(params: GenerateImageParams): {
  variants: NormalizedVariant[];
  common: ReferenceImage[];
} {
  const common = sanitizeRefs(params.referenceImages) ?? [];
  const list = Array.isArray(params.variants) ? params.variants : [];
  const variants: NormalizedVariant[] = list.slice(0, MAX_COUNT).map((v) => ({
    prompt: typeof v?.prompt === "string" ? v.prompt.trim() : "",
    referenceImages: sanitizeRefs(v?.referenceImages) ?? [],
  }));
  const renderable = variants.some(
    (v) => v.prompt || v.referenceImages.length > 0 || common.length > 0,
  );
  if (variants.length === 0 || !renderable) {
    throw new Error("프롬프트 또는 레퍼런스 이미지를 입력해주세요.");
  }
  return { variants, common };
}

export const geminiImage = {
  get isConfigured() {
    return isGeminiConfigured();
  },

  async generateStream(
    params: GenerateImageParams,
    onImage: (index: number, dataUrl: string) => void,
  ): Promise<void> {
    const { variants, common } = normalizeVariants(params);
    const preserve = !!params.preserveReference;
    const apiKey = requireGeminiKey();
    const ai = new GoogleGenAI({ apiKey });

    let hasAny = false;
    await Promise.all(
      variants.map((v, i) =>
        sleep(i * STAGGER_MS).then(async () => {
          const contents = buildVariantContents(v.prompt, [...common, ...v.referenceImages], preserve);
          const img = await generateSlot(ai, contents, i);
          if (img) {
            hasAny = true;
            onImage(i, img);
          }
        }),
      ),
    );
    if (!hasAny) {
      throw new Error(
        "이미지가 생성되지 않았어요. 잠시 후 다시 시도해주세요. (자세한 사유는 서버 콘솔의 [gemini-image] 로그 확인)",
      );
    }
  },

  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const { variants, common } = normalizeVariants(params);
    const preserve = !!params.preserveReference;
    const apiKey = requireGeminiKey();
    const ai = new GoogleGenAI({ apiKey });

    const results = await Promise.all(
      variants.map((v, i) =>
        sleep(i * STAGGER_MS).then(() =>
          generateSlot(ai, buildVariantContents(v.prompt, [...common, ...v.referenceImages], preserve), i),
        ),
      ),
    );

    const images = results.filter((v): v is string => !!v);
    if (images.length === 0) {
      throw new Error(
        "이미지가 생성되지 않았어요. 잠시 후 다시 시도해주세요. (자세한 사유는 서버 콘솔의 [gemini-image] 로그 확인)",
      );
    }
    return { images };
  },
};
