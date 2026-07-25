import { NextRequest, NextResponse } from "next/server";
import { geminiSop } from "@/lib/gemini-sop";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiSop.isConfigured,
    "GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.",
    async () => {
      const body = (await req.json()) as { raw?: unknown };
      if (typeof body.raw !== "string" || body.raw.trim().length < 10) {
        throw new ValidationError("raw 줄글 SOP 가 너무 짧아요 (10자 이상).");
      }
      const result = await geminiSop.classify({ raw: body.raw });
      return NextResponse.json(result);
    },
  );
}
