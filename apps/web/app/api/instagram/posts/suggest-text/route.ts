import { NextRequest, NextResponse } from "next/server";
import { geminiPostSuggest, type BrandContext } from "@/lib/gemini-post-suggest";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";

type Body = {
  kind?: "caption" | "image-prompt";
  hint?: string;
  caption?: string;
  brandContext?: BrandContext;
};

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiPostSuggest.isConfigured,
    "Gemini API 키가 설정되지 않았어요.",
    async () => {
      const body = (await req.json()) as Body;
      const hint = (body.hint ?? "").trim();
      const caption = (body.caption ?? "").trim();
      const ctx = body.brandContext;
      if (body.kind === "caption") {
        const text = await geminiPostSuggest.suggestCaption(hint, ctx);
        return NextResponse.json({ text });
      }
      if (body.kind === "image-prompt") {
        const text = await geminiPostSuggest.suggestImagePrompt(hint, caption, ctx);
        return NextResponse.json({ text });
      }
      throw new ValidationError("kind 는 'caption' 또는 'image-prompt' 여야 해요.");
    },
  );
}
