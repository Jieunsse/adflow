import { NextRequest, NextResponse } from "next/server";
import { geminiSuggestCampaign, type SuggestCampaignParams } from "@/lib/gemini-suggest-campaign";
import { withRouteHandler } from "@/lib/route-handler";

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiSuggestCampaign.isConfigured,
    "GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.",
    async () => {
      const body = (await req.json()) as Partial<SuggestCampaignParams>;
      const result = await geminiSuggestCampaign.suggest({
        brandDescription: body.brandDescription,
        brandVoice: body.brandVoice,
        tone: body.tone,
        recentObjectives: body.recentObjectives,
      });
      return NextResponse.json(result);
    },
  );
}
