// ADR-038/050 — /create 카피 훅 편향용 Hypothesis Ledger 조회.
// 소유 유저의 Brand Profile 전체 토너먼트를 평탄화해 전체 Ledger 를 반환한다.
// 컨텍스트(제품·목표) 필터는 클라 ledgerLadder() 가 담당 — 이 라우트는 전체 브랜드 학습을 준다.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseTournamentStore, ownerKeyFrom } from "@entities/ab-test/tournament/real";
import { deriveLedger } from "@entities/ab-test/tournament/hypothesis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const brandProfileId = req.nextUrl.searchParams.get("brandProfileId");
  if (!brandProfileId) return NextResponse.json({ ledger: [] });

  const session = await getServerSession(authOptions);
  if (!session || session.browseMode || !session.accessToken) {
    return NextResponse.json({ ledger: [] });
  }

  const ownerKey = ownerKeyFrom(session.user?.email, session.accessToken);
  const tournaments = await supabaseTournamentStore.listByBrandOwner(brandProfileId, ownerKey);
  return NextResponse.json({ ledger: deriveLedger(tournaments) });
}
