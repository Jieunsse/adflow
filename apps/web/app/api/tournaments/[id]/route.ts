// ADR-038 — 실 유저 토너먼트 단건 조회·종료. 소유 검증 후 진행.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler } from "@/lib/route-handler";
import { getRealTournamentRunner, supabaseTournamentStore, ownerKeyFrom } from "@entities/ab-test/tournament/real";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ownerGuardedTournament(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || session.browseMode || !session.accessToken || !session.adAccountId || !session.pageId) {
    return { error: NextResponse.json({ error: "Meta 광고 계정·페이지 연결이 필요해요." }, { status: 409 }) };
  }
  const ownerKey = ownerKeyFrom(session.user?.email, session.accessToken);
  const t = await supabaseTournamentStore.get(id);
  if (!t || t.delivery?.ownerEmail !== ownerKey) {
    return { error: NextResponse.json({ error: "토너먼트를 찾을 수 없어요." }, { status: 404 }) };
  }
  return { tournament: t };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await ownerGuardedTournament(id);
  if (guard.error) return guard.error;
  return NextResponse.json({ tournament: guard.tournament });
}

// 조기 종료(endTournament).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await ownerGuardedTournament(id);
  if (guard.error) return guard.error;
  return withRouteHandler(true, "", async () => {
    await getRealTournamentRunner().endTournament(id);
    return NextResponse.json({ ok: true });
  });
}
