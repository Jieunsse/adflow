import { NextRequest, NextResponse } from "next/server";
import { geminiSop, type SopType } from "@/lib/gemini-sop";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";

const VALID_TYPES: SopType[] = [
  "prohibited_words",
  "length_limits",
  "cta_restrictions",
  "industry_regulations",
  "competitor_policy",
  "pricing_rules",
  "audience_restrictions",
  "platform_rules",
];

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiSop.isConfigured,
    "GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.",
    async () => {
      const body = (await req.json()) as { type?: unknown; industry?: unknown };
      if (typeof body.type !== "string" || !VALID_TYPES.includes(body.type as SopType)) {
        throw new ValidationError("type 이 SOP 8 가드레일 중 하나가 아니에요.");
      }
      const industry =
        typeof body.industry === "string" && body.industry.trim().length > 0
          ? body.industry.trim()
          : undefined;
      const result = await geminiSop.sectionSuggest({ type: body.type as SopType, industry });
      return NextResponse.json(result);
    },
  );
}
