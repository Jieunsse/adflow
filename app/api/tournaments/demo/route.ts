// ADR-038 — 둘러보기 토너먼트 stateless 데모 라우트. 클라가 현재 tournament 를 통째로 보내면 서버가
// engine.ts(z-검정·CPLC·승격)로 게재·결산·무인진행을 실행해 변형본을 돌려준다. localStorage 는 클라가
// 진실의 원천으로 유지(응답을 upsert) — 서버는 무상태 계산기. Meta 개발모드라 실게재는 못 하지만,
// 로직이 "깡통 퍼블리싱"이 아니라 실제로 서버에서 도는 걸 시연 네트워크로 증명하기 위한 경로다.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";
import { applyLaunch, applySettle, applyAutoAdvance, type CreativeGen } from "@entities/ab-test/tournament/transitions";
import type { Tournament } from "@entities/ab-test/tournament/engine";
import { DEMO_CREATIVE_RESULT } from "@/lib/demo/content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 무인 진행 챌린저 카피 — 실 경로의 Gemini 대신 정적 데모 응답(browseMode 의 generate-creative 와 동일 소스).
const DEMO_GEN: CreativeGen = {
  headlines: DEMO_CREATIVE_RESULT.headlines,
  primaryTexts: DEMO_CREATIVE_RESULT.primaryTexts,
};

type Body = { tournament?: Tournament; action?: string; days?: number };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.browseMode) {
    return NextResponse.json({ error: "둘러보기 모드 전용 경로예요." }, { status: 409 });
  }
  return withRouteHandler(true, "", async () => {
    const b = (await req.json()) as Body;
    const t = b.tournament;
    if (!t || typeof t !== "object" || !Array.isArray(t.rounds)) {
      throw new ValidationError("tournament 가 필요해요.");
    }
    switch (b.action) {
      case "launch": {
        const { t: nt } = applyLaunch(t);
        return NextResponse.json({ tournament: nt });
      }
      case "settle": {
        const { t: nt, result } = applySettle(t, b.days ?? 0);
        return NextResponse.json({ tournament: nt, result });
      }
      case "auto-advance": {
        const { t: nt } = applyAutoAdvance(t, DEMO_GEN);
        return NextResponse.json({ tournament: nt });
      }
      default:
        throw new ValidationError("알 수 없는 action 이에요.");
    }
  });
}
