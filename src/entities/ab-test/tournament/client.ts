"use client";

// ADR-038 — 데모/실 토너먼트 통합 클라이언트. UI(목록·상세·셋업)의 browseMode 분기를 한 곳으로 모은다.
// demo = 동기 localStorage runner 를 Promise 로 감싼 그대로(변경 이벤트는 runner 내부 upsert 가 발화),
// real = /api/tournaments/* fetch(서버 오케스트레이터 → Supabase + Meta). 둘 다 mutation 후 최신
// Tournament 를 돌려줘 UI 가 setT 한다 — real 은 localStorage 변경 이벤트가 없으므로 반환값이 유일 소스.

import {
  regenerateChampion,
  confirmChampion,
  proposeChallenger,
  setManualChallenger,
  endTournament,
  resolveAnomaly,
  discardPendingChallenger,
  refillEnvelope,
} from "./runner";
import { getTournament, upsertTournament, listTournaments } from "./tournament";
import type { Tournament, TourVariant } from "./tournament";
import type { RoundSettleResult } from "./transitions";

// 데모 mutation 을 stateless mock 라우트로 위임 — 현재 tournament 를 보내고 서버가 engine 으로 변형한 결과를
// localStorage 에 upsert(변경 이벤트 발화)한다. 게재/결산/무인진행이 클라 내부가 아니라 서버에서 돈다.
async function demoMutate(
  id: string,
  body: { action: string; days?: number },
): Promise<{ tournament: Tournament | null; result?: RoundSettleResult }> {
  const t = getTournament(id);
  if (!t) return { tournament: null };
  const data = await apiJson<{ tournament: Tournament; result?: RoundSettleResult }>("/api/tournaments/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tournament: t, ...body }),
  });
  if (data.tournament) upsertTournament(data.tournament);
  return data;
}

// PresenterTournamentBar 전용 — 결산/무인진행을 데모 mock 라우트로 위임(서버에서 engine 실행).
export async function demoSettleRound(id: string, days: number): Promise<RoundSettleResult> {
  const { result } = await demoMutate(id, { action: "settle", days });
  return result ?? { status: "no-active" };
}

export async function demoAutoAdvance(id: string): Promise<void> {
  await demoMutate(id, { action: "auto-advance" });
}

export interface TournamentClient {
  isReal: boolean;
  list(): Promise<Tournament[]>;
  get(id: string): Promise<Tournament | null>;
  regenerateChampion(id: string): Promise<Tournament | null>;
  confirmChampion(id: string, edited?: TourVariant): Promise<Tournament | null>;
  proposeChallenger(id: string): Promise<Tournament | null>;
  setChallenger(id: string, v: TourVariant): Promise<Tournament | null>;
  launch(id: string): Promise<Tournament | null>;
  end(id: string): Promise<Tournament | null>;
  resolveAnomaly(id: string): Promise<Tournament | null>;
  discardChallenger(id: string): Promise<Tournament | null>;
  refillEnvelope(id: string, addBudget?: number): Promise<Tournament | null>;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || "요청에 실패했어요.");
  return data as T;
}

// 데모 — 동기 runner 실행 후 최신 스냅샷 반환. async 시그니처로 맞춰 UI 가 분기 없이 await.
function demoClient(): TournamentClient {
  const snap = (id: string) => getTournament(id);
  return {
    isReal: false,
    async list() {
      return listTournaments();
    },
    async get(id) {
      return getTournament(id);
    },
    async regenerateChampion(id) {
      await regenerateChampion(id);
      return snap(id);
    },
    async confirmChampion(id, edited) {
      confirmChampion(id, edited);
      return snap(id);
    },
    async proposeChallenger(id) {
      await proposeChallenger(id);
      return snap(id);
    },
    async setChallenger(id, v) {
      setManualChallenger(id, v);
      return snap(id);
    },
    async launch(id) {
      const { tournament } = await demoMutate(id, { action: "launch" });
      return tournament;
    },
    async end(id) {
      endTournament(id);
      return snap(id);
    },
    async resolveAnomaly(id) {
      resolveAnomaly(id);
      return snap(id);
    },
    async discardChallenger(id) {
      discardPendingChallenger(id);
      return snap(id);
    },
    async refillEnvelope(id, addBudget) {
      refillEnvelope(id, addBudget);
      return snap(id);
    },
  };
}

// 실 — action 라우트로 POST. 응답 { tournament } 를 그대로 반환. 종료만 [id] DELETE 경로.
function realClient(): TournamentClient {
  const get = (id: string) =>
    apiJson<{ tournament: Tournament }>(`/api/tournaments/${id}`)
      .then((d) => d.tournament)
      .catch(() => null);
  const act = (id: string, body: object) =>
    apiJson<{ tournament: Tournament }>(`/api/tournaments/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((d) => d.tournament);
  return {
    isReal: true,
    async list() {
      return (await apiJson<{ tournaments: Tournament[] }>("/api/tournaments")).tournaments;
    },
    get,
    regenerateChampion: (id) => act(id, { action: "regenerate-champion" }),
    confirmChampion: (id, edited) => act(id, { action: "confirm-champion", variant: edited }),
    proposeChallenger: (id) => act(id, { action: "propose-challenger" }),
    setChallenger: (id, v) => act(id, { action: "set-challenger", variant: v }),
    launch: (id) => act(id, { action: "launch" }),
    async end(id) {
      await apiJson(`/api/tournaments/${id}`, { method: "DELETE" });
      return get(id);
    },
    resolveAnomaly: (id) => act(id, { action: "resolve-anomaly" }),
    discardChallenger: (id) => act(id, { action: "discard-challenger" }),
    refillEnvelope: (id, addBudget) => act(id, { action: "refill-envelope", addBudget }),
  };
}

export function tournamentClient(browseMode: boolean): TournamentClient {
  return browseMode ? demoClient() : realClient();
}
