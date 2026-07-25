import { NextRequest, NextResponse } from "next/server";
import { geminiChannelDraft, type GenerateChannelDraftParams } from "@/lib/gemini-channel-draft";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiChannelDraft.isConfigured,
    "GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.",
    async () => {
      const body = (await req.json()) as Partial<GenerateChannelDraftParams>;
      const { channel, suggestionTitle, suggestionDetail } = body;
      if (channel !== "instagram" && channel !== "facebook") {
        throw new ValidationError("channel 은 instagram | facebook 이어야 해요.");
      }
      if (!suggestionTitle || typeof suggestionTitle !== "string") {
        throw new ValidationError("suggestionTitle 이 필요해요.");
      }
      if (!Array.isArray(suggestionDetail) || suggestionDetail.some((d) => typeof d !== "string")) {
        throw new ValidationError("suggestionDetail 은 문자열 배열이어야 해요.");
      }
      try {
        const result = await geminiChannelDraft.generate({ channel, suggestionTitle, suggestionDetail });
        return NextResponse.json(result);
      } catch (err) {
        console.error("[channel-suggestion/draft] generate failed:", err);
        throw err;
      }
    },
  );
}
