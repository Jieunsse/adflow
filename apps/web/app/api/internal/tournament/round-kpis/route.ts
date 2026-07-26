// 역위임 수신구 (설계 §9) — Spring 이 라운드를 결산하다 Meta KPI 가 필요하면 여기로 되묻는다.
// Meta 클라이언트가 아직 TS 라 생긴 왕복이고, 단계 6 에서 Java 로 옮기면 이 라우트는 사라진다.
//
// 인증 = 내부 시크릿. cron 과 마찬가지로 세션이 없는 기계 호출이다.
// 토너먼트·라운드는 Spring 이 바디에 실어 보낸다 — 여기서 다시 조회하면 순환이고, 그 사이 행이
// 바뀌면 판정과 KPI 가 서로 다른 스냅샷을 보게 된다.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { internalSecret } from "@shared/lib/backend/client";
import { createMetaKpiSource } from "@entities/ab-test/tournament/meta-kpi-source";
import type { Tournament, TourRound } from "@entities/ab-test/tournament/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = internalSecret();
  if (!secret) return false; // 미설정은 곧 잠금 (Spring InternalSecret 과 같은 규칙)
  const presented = Buffer.from(req.headers.get("x-internal-secret") ?? "");
  const expected = Buffer.from(secret);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tournament, round } = (await req.json()) as { tournament: Tournament; round: TourRound };
  const source = createMetaKpiSource();
  const kpis = await source.roundKpis(tournament, round);

  // ADR §4 정석 — ad study 의 Meta 유의성 결과가 verdict 다. null 이면 스터디가 아직 진행 중이라
  // Spring 이 결산을 보류한다(다음 폴에 재시도).
  const mv = (await source.roundVerdict?.(tournament, round, kpis)) ?? null;

  return NextResponse.json({ kpis, verdict: mv?.verdict ?? null, winner: mv?.winner ?? null });
}
