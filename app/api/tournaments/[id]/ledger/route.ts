// ADR-047 — 실 유저 Hypothesis Ledger 투영 조회. 전용 테이블 없이 소유 유저의 같은 Brand Profile
// 토너먼트를 평탄화(rounds[].hypothesis 중 resolved)해 이 토너먼트 맥락(제품·목표)으로 필터해 돌려준다.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseTournamentStore, ownerKeyFrom } from "@entities/ab-test/tournament/real";
import { deriveLedger, filterByContext } from "@entities/ab-test/tournament/hypothesis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.browseMode || !session.accessToken || !session.adAccountId || !session.pageId) {
    return NextResponse.json({ error: "Meta 광고 계정·페이지 연결이 필요해요." }, { status: 409 });
  }
  const ownerKey = ownerKeyFrom(session.user?.email, session.accessToken);
  const t = await supabaseTournamentStore.get(id);
  if (!t || t.delivery?.ownerEmail !== ownerKey) {
    return NextResponse.json({ error: "토너먼트를 찾을 수 없어요." }, { status: 404 });
  }
  const ledger = deriveLedger(await supabaseTournamentStore.listByBrandOwner(t.brandProfileId, ownerKey));
  const relevant = filterByContext(ledger, { productId: t.productId, objective: t.objective });
  return NextResponse.json({ ledger: relevant });
}
