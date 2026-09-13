import { NextResponse, type NextRequest } from "next/server";
import { getRealTournamentRunner, tournamentStore } from "@entities/ab-test/tournament/real";
import { recordCronRun } from "@shared/lib/cron-runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const presented = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  if (!expected || presented !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = new Date().toISOString();
  const runner = getRealTournamentRunner();
  const tournaments = await tournamentStore.list();
  let settled = 0;
  let advanced = 0;
  const errors: string[] = [];
  for (const tournament of tournaments.filter((item) => item.status === "running")) {
    try {
      const result = await runner.pollAndSettle(tournament.id);
      if (result.status === "settled") settled += 1;
      await runner.autoAdvance(tournament.id);
      advanced += 1;
    } catch (error) {
      errors.push(`${tournament.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await recordCronRun({ job: "tournament-poller", ok: errors.length === 0, scanned: tournaments.length, settled, advanced, errors, startedAt });
  return NextResponse.json({ scanned: tournaments.length, settled, advanced, errors });
}
