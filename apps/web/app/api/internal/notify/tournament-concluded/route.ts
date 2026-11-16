// SSE 알림 다리 (설계 §6) — Spring 폴러가 라운드를 결산하면 여기로 알린다. server-side only.
//
// 열린 SSE 커넥션은 이 프로세스 **메모리**의 Map 에 있다. Spring 은 다른 프로세스라 닿을 수 없어서
// 이 다리가 필수다. 연결이 없으면 push 가 0 을 돌려주고 끝난다 — 알림은 최선 노력이다.
//
// 문구는 여기서 만든다. 하우스 보이스(해요체)는 화면 쪽 규칙이라 서버가 한국어를 조립하지 않는다.

import { NextRequest, NextResponse } from "next/server";
import { pushTournamentConcluded } from "@/lib/notifications/registry";
import { isInternalCall } from "@shared/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Body {
  ownerToken: string;
  tournamentId: string;
  productName: string;
  roundIndex: number;
  winnerIsB: boolean;
  completed: boolean;
  launchedAt?: string;
}

export async function POST(req: NextRequest) {
  if (!isInternalCall(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const b = (await req.json()) as Body;
  const delivered = pushTournamentConcluded(b.ownerToken, {
    id: `tourn-${b.tournamentId}-r${b.roundIndex}-${b.launchedAt ?? ""}`,
    message: b.completed
      ? `🏁 '${b.productName}' 토너먼트가 끝났어요 — 최종 챔피언이 확정됐어요.`
      : `라운드 ${b.roundIndex} 결산 완료 — ${b.winnerIsB ? "새 챌린저 승격" : "챔피언 방어"}`,
    ts: Date.now(),
    tournamentId: b.tournamentId,
    productName: b.productName,
    roundIndex: b.roundIndex,
    winnerIsB: b.winnerIsB,
    completed: b.completed,
  });

  return NextResponse.json({ delivered });
}
