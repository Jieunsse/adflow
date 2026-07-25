// ADR-042 관측성 2겹 — dead-man's switch. 공개 GET(인증 없음). pg_net 의 fire-and-forget 은 조용히 멈추는 게
// 제일 위험하므로, 마지막 성공 폴러 실행 나이를 죽은 시스템 바깥의 외부 무료 모니터(UptimeRobot 등 30~60분 핑)가
// 감시한다. 마지막 ok=true 가 8h(주기 6h + 버퍼 2h) 초과거나 기록이 아예 없으면 503 → 외부 알림.

import { NextResponse } from "next/server";
import { getLastSuccessfulRun } from "@shared/lib/cron-runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOB = "tournament-poller";
const STALE_MS = 8 * 60 * 60 * 1000;

export async function GET() {
  let last;
  try {
    last = await getLastSuccessfulRun(JOB);
  } catch (e) {
    return NextResponse.json(
      { status: "error", job: JOB, message: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  if (!last) {
    return NextResponse.json(
      { status: "stale", job: JOB, message: "no runs recorded" },
      { status: 503 },
    );
  }

  const ageMs = Date.now() - new Date(last.finished_at).getTime();
  if (ageMs > STALE_MS) {
    return NextResponse.json(
      { status: "stale", job: JOB, lastSuccessAt: last.finished_at, ageMs },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok", job: JOB, lastSuccessAt: last.finished_at, ageMs });
}
