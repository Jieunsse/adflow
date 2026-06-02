// 플로(Flo) Briefing API (ADR-045). POST = 5소스 수집→Claude 1회→저장·반환, GET = 활성 계정 캐시 조회.
// browse 게스트: 데이터는 mock(demoFloContext)·Claude 호출은 실키(ADR-033 갱신). 그래서 withMetaSession
// onBrowse 단락 대신 핸들러 안에서 browseMode 를 직접 분기한다(tournaments/demo 와 같은 역전 패턴).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler } from "@/lib/route-handler";
import { requireMetaSession } from "@/lib/meta-session";
import { ownerKeyFrom } from "@entities/ab-test/tournament/real";
import { isClaudeConfigured } from "@/lib/claude-client";
import { isGeminiConfigured } from "@/lib/gemini-client";
import { gatherFloContext } from "@/lib/flo/gather";
import { demoFloContext } from "@/lib/flo/demo";
import { generateBriefing } from "@/lib/flo/briefing";
import { getLatestBriefing, saveBriefing } from "@/lib/flo/store";
import type { Briefing, FloBrandFact, FloContext, FloModel } from "@/lib/flo/types";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BROWSE_ACCOUNT = "browse";

// 세션에서 (userKey, adAccountId) 해석 — browse 게스트는 'browse' 계정 키로 캐시.
async function resolveScope(): Promise<{ userKey: string; adAccountId: string; browse: boolean } | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (session.browseMode) {
    return {
      userKey: ownerKeyFrom(session.user?.email, session.accessToken ?? BROWSE_ACCOUNT),
      adAccountId: BROWSE_ACCOUNT,
      browse: true,
    };
  }
  const s = requireMetaSession(session, ["adAccount"]);
  return {
    userKey: ownerKeyFrom(session.user?.email, s.accessToken),
    adAccountId: s.adAccountId,
    browse: false,
  };
}

export async function POST(req: NextRequest) {
  return withRouteHandler(true, "", async () => {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { model?: FloModel; brand?: FloBrandFact };
    const model: FloModel =
      body.model === "opus" || body.model === "gemini" ? body.model : "sonnet";

    if (model === "gemini") {
      if (!isGeminiConfigured()) {
        return NextResponse.json(
          { error: "GOOGLE_AI_API_KEY 가 설정되지 않았어요. 환경 변수를 확인해주세요." },
          { status: 503 },
        );
      }
    } else if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY 가 설정되지 않았어요. 환경 변수를 확인해주세요." },
        { status: 503 },
      );
    }

    let userKey: string;
    let adAccountId: string;
    let context: FloContext;

    if (session.browseMode) {
      userKey = ownerKeyFrom(session.user?.email, session.accessToken ?? BROWSE_ACCOUNT);
      adAccountId = BROWSE_ACCOUNT;
      context = demoFloContext(body.brand);
    } else {
      const s = requireMetaSession(session, ["adAccount"]);
      userKey = ownerKeyFrom(session.user?.email, s.accessToken);
      adAccountId = s.adAccountId;
      context = await gatherFloContext(s, session.user?.email, body.brand);
    }

    const gen = await generateBriefing(context, model);
    const briefing: Briefing = {
      id: randomUUID(),
      adAccountId,
      createdAt: new Date().toISOString(),
      ...gen,
    };
    await saveBriefing(userKey, briefing);
    return NextResponse.json({ briefing });
  });
}

export async function GET() {
  return withRouteHandler(true, "", async () => {
    const scope = await resolveScope();
    if (!scope) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    const briefing = await getLatestBriefing(scope.userKey, scope.adAccountId);
    return NextResponse.json({ briefing });
  });
}
