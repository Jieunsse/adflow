// 실 유저 토너먼트 조립점 (ADR-038) — server-side only. Supabase store + Meta 어댑터 2종으로
// 서버 오케스트레이터를 만든다. cron 폴러·API 라우트가 이 한 곳에서 같은 러너를 얻는다.

import { createHash } from "node:crypto";
import { createServerRunner, type ServerRunner } from "./server-runner";
import { supabaseTournamentStore } from "./supabase-store";
import { createMetaRoundLauncher } from "./meta-launcher";
import { createMetaKpiSource } from "./meta-kpi-source";
import type { TourVariant } from "./engine";

export function getRealTournamentRunner(): ServerRunner {
  return createServerRunner({
    store: supabaseTournamentStore,
    launcher: createMetaRoundLauncher(),
    kpiSource: createMetaKpiSource(),
  });
}

// 소유 매칭 키 — 세션 email 우선, 없으면(Facebook provider 가 email scope 미보유) 토큰 해시 폴백.
// SSE registry 의 hashToken 과 동일 길이라 cron push 대상과 일관.
export function ownerKeyFrom(email: string | null | undefined, accessToken: string): string {
  if (email && email !== "guest@adflow.local") return email;
  return createHash("sha256").update(accessToken).digest("hex").slice(0, 24);
}

const tournamentStore = supabaseTournamentStore;
export { tournamentStore };

export async function advanceOnBackend(id: string, step: "propose" | "launch"): Promise<unknown> {
  const runner = getRealTournamentRunner();
  if (step === "propose") await runner.proposeChallenger(id);
  else await runner.launchRound(id);
  const tournament = await tournamentStore.get(id);
  if (!tournament) throw new Error("토너먼트를 찾을 수 없어요.");
  return tournament;
}

export type EditAction =
  | "confirm-champion"
  | "replace-champion"
  | "set-challenger"
  | "refill-envelope"
  | "resume"
  | "end";

export async function editOnBackend(
  id: string,
  action: EditAction,
  body: { variant?: TourVariant; addBudget?: number } = {},
): Promise<unknown> {
  const runner = getRealTournamentRunner();
  if (action === "confirm-champion") await runner.confirmChampion(id, body.variant);
  if (action === "replace-champion") {
    const tournament = await tournamentStore.get(id);
    if (tournament) {
      const champion = await runner.regenerateChampion(tournament);
      if (champion) await runner.confirmChampion(id, champion);
    }
  }
  if (action === "set-challenger" && body.variant) await runner.setManualChallenger(id, body.variant);
  if (action === "refill-envelope") {
    const tournament = await tournamentStore.get(id);
    if (tournament?.envelope && body.addBudget) {
      tournament.envelope = { ...tournament.envelope, totalBudget: (tournament.envelope.totalBudget ?? 0) + body.addBudget };
      tournament.lastError = undefined;
      await tournamentStore.upsert(tournament);
    }
  }
  if (action === "resume") {
    const tournament = await tournamentStore.get(id);
    if (tournament) {
      tournament.lastError = undefined;
      await tournamentStore.upsert(tournament);
    }
  }
  if (action === "end") await runner.endTournament(id);
  const tournament = await tournamentStore.get(id);
  if (!tournament) throw new Error("토너먼트를 찾을 수 없어요.");
  return tournament;
}
