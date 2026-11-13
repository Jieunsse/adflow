// ADR-038 — 실 유저 토너먼트 API. 서버 오케스트레이터(real.ts)를 HTTP 로 노출.
// 데모(browseMode)는 localStorage 동기 경로라 이 라우트를 쓰지 않는다 — 실 Meta 계정 연결 유저 전용.
// 세션에서 토큰/계정/페이지를 읽어 delivery 봉투를 구성(cron 이 세션 없이 게재·폴링할 수 있도록 저장).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";
import { callBackend } from "@shared/lib/backend/call";
import { getRealTournamentRunner, tournamentStore, ownerKeyFrom } from "@entities/ab-test/tournament/real";
import { MIN_ROUND_DAYS, type TournamentDelivery, type TourEnvelope } from "@entities/ab-test/tournament/engine";
import type { ServerTournamentSetup } from "@entities/ab-test/tournament/server-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RealSession = {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  ownerKey: string;
  email?: string | null;
};

// 실 유저 가드 — browseMode/미연결이면 차단. 통과 시 게재에 필요한 자격증명 묶음 반환.
async function requireRealSession(): Promise<RealSession | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.browseMode || !session.accessToken || !session.adAccountId || !session.pageId) {
    return NextResponse.json({ error: "Meta 광고 계정·페이지 연결이 필요해요." }, { status: 409 });
  }
  return {
    accessToken: session.accessToken,
    adAccountId: session.adAccountId,
    pageId: session.pageId,
    email: session.user?.email,
    ownerKey: ownerKeyFrom(session.user?.email, session.accessToken),
  };
}

export async function GET() {
  const s = await requireRealSession();
  if (s instanceof NextResponse) return s;
  return withRouteHandler(true, "", async () =>
    NextResponse.json({ tournaments: await tournamentStore.listByOwner(s.ownerKey) }),
  );
}

interface CreateBody {
  brandProfileId: string;
  productId?: string;
  productName: string;
  brandDescription?: string;
  productDescription?: string;
  tone: string;
  objective: string;
  envelope?: TourEnvelope; // ADR-054/061 — 총예산·(선택)목표일·자동충전
  dailyBudget: number;
  startingCtr: number;
  championSource?: "ai" | "existing";
  startingChampion?: { headline: string; primaryText: string; imageUrl?: string };
  championSourceName?: string;
  // delivery 게재 스펙 (세션이 못 주는 광고 파라미터)
  goalId?: string;
  linkUrl: string;
  ctaType: string;
  countries: string[];
  ageMin: number;
  ageMax: number;
  genders?: number[];
  imageDataUrl?: string;
  prohibitedWords?: string[];
}

export async function POST(req: NextRequest) {
  const s = await requireRealSession();
  if (s instanceof NextResponse) return s;
  return withRouteHandler(true, "", async () => {
    const b = (await req.json()) as Partial<CreateBody>;
    if (!b.productName?.trim()) throw new ValidationError("제품명을 입력해주세요.");
    if (!b.linkUrl?.trim()) throw new ValidationError("랜딩 URL 을 입력해주세요.");
    if (!b.countries?.length) throw new ValidationError("타겟 지역(국가)을 최소 한 곳 선택해주세요.");
    if (!b.dailyBudget || b.dailyBudget <= 0) throw new ValidationError("일 예산을 입력해주세요.");
    if (!b.brandProfileId) throw new ValidationError("브랜드를 먼저 골라 주세요.");

    // 광고 계정·페이지는 세션이 아니라 이 브랜드의 연결에서 읽는다 (기능 10).
    // 세션 값을 쓰면 브랜드를 바꾼 직후 다른 고객의 광고 계정으로 광고가 나갈 수 있다.
    const brand = await callBackend(req, `/brands/${encodeURIComponent(b.brandProfileId)}`);
    if (!brand.ok) return NextResponse.json({ error: brand.message }, { status: brand.status });
    const conn = brand.res.ok
      ? ((await brand.res.json()) as { adAccountId?: string; pageId?: string })
      : {};
    if (!conn.adAccountId || !conn.pageId) {
      return NextResponse.json(
        { error: "이 브랜드에 광고 계정이 아직 연결되지 않았어요. 계정 연결에서 광고 계정과 페이지를 골라 주세요." },
        { status: 409 },
      );
    }

    const delivery: TournamentDelivery = {
      accessToken: s.accessToken,
      adAccountId: conn.adAccountId,
      pageId: conn.pageId,
      ownerEmail: s.ownerKey,
      goalId: b.goalId,
      linkUrl: b.linkUrl,
      ctaType: b.ctaType || "LEARN_MORE",
      countries: b.countries,
      ageMin: b.ageMin ?? 18,
      ageMax: b.ageMax ?? 65,
      genders: b.genders,
      roundDays: MIN_ROUND_DAYS,
      imageDataUrl: b.imageDataUrl,
    };

    const setup: ServerTournamentSetup = {
      brandProfileId: b.brandProfileId,
      productId: b.productId || "manual",
      productName: b.productName.trim(),
      brandDescription: b.brandDescription,
      productDescription: b.productDescription,
      tone: b.tone || "warm",
      objective: b.objective || "traffic",
      envelope: b.envelope,
      dailyBudget: b.dailyBudget,
      startingCtr: b.startingCtr ?? 1.8,
      championSource: b.championSource,
      startingChampion: b.startingChampion,
      championSourceName: b.championSourceName,
      prohibitedWords: b.prohibitedWords,
      delivery,
    };

    const id = await getRealTournamentRunner().createTournament(setup);
    return NextResponse.json({ id });
  });
}
