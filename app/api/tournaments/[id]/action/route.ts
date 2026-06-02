// ADR-038 — 실 유저 토너먼트 라운드 진행 액션. 상세 UI(섬2 후속)가 호출.
// 한 라우트로 비트별 액션을 묶는다 — confirm-champion / regenerate-champion / propose-challenger /
// set-challenger / launch / refill-envelope (ADR-054 — anomaly 액션 폐기).
// launch 는 실제 Meta 게재라 비용이 발생 — 소유 검증을 통과한 유저만.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";
import { getRealTournamentRunner, supabaseTournamentStore, ownerKeyFrom } from "@entities/ab-test/tournament/real";
import type { TourVariant } from "@entities/ab-test/tournament/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Action =
  | "confirm-champion"
  | "regenerate-champion"
  | "propose-challenger"
  | "set-challenger"
  | "launch"
  | "refill-envelope";

interface ActionBody {
  action: Action;
  variant?: TourVariant; // confirm-champion(edited) / set-challenger
  addBudget?: number; // refill-envelope
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.browseMode || !session.accessToken || !session.adAccountId || !session.pageId) {
    return NextResponse.json({ error: "Meta 광고 계정·페이지 연결이 필요해요." }, { status: 409 });
  }
  const ownerKey = ownerKeyFrom(session.user?.email, session.accessToken);
  const existing = await supabaseTournamentStore.get(id);
  if (!existing || existing.delivery?.ownerEmail !== ownerKey) {
    return NextResponse.json({ error: "토너먼트를 찾을 수 없어요." }, { status: 404 });
  }

  return withRouteHandler(true, "", async () => {
    const b = (await req.json()) as Partial<ActionBody>;
    const r = getRealTournamentRunner();
    switch (b.action) {
      case "confirm-champion":
        await r.confirmChampion(id, b.variant);
        break;
      case "regenerate-champion":
        await r.regenerateChampion(id);
        break;
      case "propose-challenger":
        await r.proposeChallenger(id);
        break;
      case "set-challenger":
        if (!b.variant) throw new ValidationError("챌린저 내용이 없어요.");
        await r.setManualChallenger(id, b.variant);
        break;
      case "launch":
        await r.launchRound(id);
        break;
      case "refill-envelope":
        await r.refillEnvelope(id, b.addBudget);
        break;
      default:
        throw new ValidationError("알 수 없는 액션이에요.");
    }
    return NextResponse.json({ tournament: await supabaseTournamentStore.get(id) });
  });
}
