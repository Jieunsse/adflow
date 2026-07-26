// 챌린저 카피 생성 — Spring 폴러가 부른다. server-side only.
//
// Gemini 를 Java 로 옮기지 않은 이유: 프롬프트(gemini-creative.ts 521줄)가 화면 생성 경로와 같은
// 파일에 살고, 옮기면 같은 한국어 프롬프트가 두 곳에서 갈라진다. 설계 §6 도 Meta 클라이언트만
// 재작성 대상으로 적었다.

import { NextRequest, NextResponse } from "next/server";
import { geminiCreative } from "@/lib/gemini-creative";
import type { ObjectiveId } from "@entities/creative/options";
import { isInternalCall } from "@shared/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Body {
  brand: string;
  target: string;
  tone: string;
  outcome: string;
  productName: string;
  productDescription: string;
  variationIntensity?: "subtle" | "moderate" | "bold";
  prohibitedWords?: string[];
}

export async function POST(req: NextRequest) {
  if (!isInternalCall(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const b = (await req.json()) as Body;
  const res = await geminiCreative.generate({
    brand: b.brand,
    target: b.target,
    tone: b.tone,
    outcome: b.outcome as ObjectiveId,
    product: { name: b.productName, description: b.productDescription },
    variationIntensity: b.variationIntensity,
    prohibitedWords: b.prohibitedWords, // ADR-054 — 금칙어는 생성 단계에서 구조로 배제
  });

  return NextResponse.json({ headlines: res.headlines, primaryTexts: res.primaryTexts });
}
