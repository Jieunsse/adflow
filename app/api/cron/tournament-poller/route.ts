// ADR-038 결정 3 — 서버 cron 폴러. 브라우저 없이 실 유저 토너먼트를 진행한다.
// running 토너먼트마다: ① Meta KPI 로 결산 시도(MIN_ROUND_DAYS 미달이면 보류) ② 결산되면 auto 무인 체인으로
// 다음 라운드 자동 게재 ③ owner 의 열린 SSE 스트림으로 tournament-round-concluded push(연결 없으면 no-op).
//
// 인증 = CRON_SECRET (Vercel Cron 은 authorization: Bearer ${CRON_SECRET} 로 호출). 세션 없음 —
// 게재·폴링·푸시에 필요한 토큰/계정/페이지는 토너먼트 delivery 봉투(Supabase)에서 읽는다.

import { NextRequest, NextResponse } from "next/server";
import { getRealTournamentRunner, supabaseTournamentStore } from "@entities/ab-test/tournament/real";
import { pushTournamentConcluded } from "@/lib/notifications/registry";
import { deriveBeat } from "@entities/ab-test/tournament/engine";
import { recordCronRun } from "@shared/lib/cron-runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // 미설정이면 폴러를 열어두지 않는다(보수적)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  let scanned = 0;
  let settled = 0;
  let advanced = 0;
  const errors: string[] = [];

  try {
    const runner = getRealTournamentRunner();
    const all = await supabaseTournamentStore.list();
    // ADR-053 — 게재 실패(lastError)로 멈춘 토너먼트는 자동 진행 대상에서 제외(상세 배너가 사람에게 알림).
    const active = all.filter((t) => t.status === "running" && t.delivery && !t.lastError);
    scanned = active.length;

    for (const t of active) {
      try {
        const result = await runner.pollAndSettle(t.id);
        if (result.status === "settled") settled += 1;

        // auto 무인 체인 — 부트스트랩(1라운드) + 결산 후 다음 라운드. 러닝/미확정 챔피언/봉투·이상신호
        // 브레이크는 autoAdvance 가 가드하므로 매 틱 호출해도 안전. settle 안 됐어도 굴려 1라운드를 띄운다.
        if (t.mode === "auto") {
          await runner.autoAdvance(t.id);
        }

        if (result.status !== "settled") continue;

        // 결산 후 최신 상태로 SSE push (autoAdvance 가 status 를 바꿨을 수 있어 다시 읽는다).
        const fresh = await supabaseTournamentStore.get(t.id);
        if (!fresh?.delivery) continue;
        if (fresh.mode === "auto" && deriveBeat(fresh) === "auto-running" && !result.completed) {
          advanced += 1;
        }
        pushTournamentConcluded(fresh.delivery.accessToken, {
          id: `tourn-${fresh.id}-r${result.round.index}-${result.round.launchedAt ?? ""}`,
          message: result.completed
            ? `🏁 '${fresh.productName}' 토너먼트가 끝났어요 — 최종 챔피언이 확정됐어요.`
            : `라운드 ${result.round.index} 결산 완료 — ${result.winnerIsB ? "새 챌린저 승격" : "챔피언 방어"}`,
          ts: Date.now(),
          tournamentId: fresh.id,
          productName: fresh.productName,
          roundIndex: result.round.index,
          winnerIsB: result.winnerIsB,
          completed: result.completed,
        });
      } catch (e) {
        errors.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    // 스캔 자체 실패(store.list 등) — finally 에서 ok=false 로 기록되도록 errors 에 적재.
    errors.push(`poller: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await recordCronRun({ job: "tournament-poller", ok: errors.length === 0, scanned, settled, advanced, errors, startedAt });
  }

  return NextResponse.json({ scanned, settled, advanced, errors });
}
