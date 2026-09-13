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
  refillEnvelope,
} from "./runner";
import { getTournament, upsertTournament, listTournaments, deriveBeat } from "./tournament";
import type { Tournament, TourVariant, Lever, HypothesisVerdict, Hypothesis } from "./tournament";
import type { RoundSettleResult } from "./transitions";
import { relevantLedger, syncResolvedFromTournament } from "./ledger";

// 데모 mutation 을 stateless mock 라우트로 위임 — 현재 tournament 를 보내고 서버가 engine 으로 변형한 결과를
// localStorage 에 upsert(변경 이벤트 발화)한다. 게재/결산/무인진행이 클라 내부가 아니라 서버에서 돈다.
async function demoMutate(
  id: string,
  body: { action: string; days?: number },
): Promise<{ tournament: Tournament | null; result?: RoundSettleResult }> {
  const t = getTournament(id);
  if (!t) return { tournament: null };
  // ADR-044 — auto-advance 의 가설 생성기가 Ledger 를 읽어 레버를 고른다(서버 무상태라 클라가 맥락 필터해 주입).
  const ledger = relevantLedger(t.brandProfileId, { productId: t.productId, objective: t.objective });
  const data = await apiJson<{ tournament: Tournament; result?: RoundSettleResult }>("/api/tournaments/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tournament: t, ledger, ...body }),
  });
  if (data.tournament) {
    syncResolvedFromTournament(data.tournament); // 먼저 Ledger 적재(패널이 변경 이벤트로 최신 읽도록) 후 토너먼트 upsert
    upsertTournament(data.tournament);
  }
  return data;
}

// ADR-044 캐스케이드 — 콘솔 시간 1회 advance 가 봉투 소진/필요 브레이크(ADR-035)까지 전체 auto 루프를 돈다.
// 만기 결산→가설 판정→챔피언 갱신→Ledger 적재→다음 가설 게재 반복. 각 결산 라운드를 관전 로그로 push.
export type CascadeStep = {
  round: number;
  lever?: Lever;
  statement?: string;
  verdict?: HypothesisVerdict;
  winnerIsB: boolean;
};

export async function demoCascade(id: string, roundDays = 7): Promise<CascadeStep[]> {
  const log: CascadeStep[] = [];
  for (let i = 0; i < 16; i++) {
    const t = getTournament(id);
    if (!t) break;
    const beat = deriveBeat(t);
    if (beat === "done") break;
    // ADR-054 진짜 브레이크 — 예산 소진(winner-handling)·출발 챔피언 게이트(champion-review)만 멈춘다.
    if (beat === "winner-handling" || beat === "champion-review") break;
    const running = t.rounds.find((r) => r.status === "running");
    if (running) {
      const { result } = await demoMutate(id, { action: "settle", days: running.fastForwardDays + roundDays });
      if (result?.status === "settled") {
        const h = result.round.hypothesis;
        log.push({ round: result.round.index, lever: h?.lever, statement: h?.statement, verdict: h?.verdict, winnerIsB: result.winnerIsB });
      }
    } else {
      await demoMutate(id, { action: "auto-advance" });
    }
  }
  return log;
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
  refillEnvelope(id: string, addBudget?: number): Promise<Tournament | null>;
  // ADR-053 복구 — 게재 실패로 멈춘 토너먼트(lastError)를 사람이 확인 후 재시도.
  resume(id: string): Promise<Tournament | null>;
  // ADR-047 — 이 토너먼트 맥락(브랜드·제품·목표)에 관련된 학습 노트(Hypothesis Ledger). 데모=localStorage, 실=투영.
  getLedger(id: string): Promise<Hypothesis[]>;
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
    async refillEnvelope(id, addBudget) {
      refillEnvelope(id, addBudget);
      return snap(id);
    },
    async resume(id) {
      const t = getTournament(id);
      if (!t || !t.lastError) return snap(id);
      upsertTournament({ ...t, lastError: undefined });
      return snap(id);
    },
    async getLedger(id) {
      const t = getTournament(id);
      if (!t) return [];
      return relevantLedger(t.brandProfileId, { productId: t.productId, objective: t.objective });
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
    refillEnvelope: (id, addBudget) => act(id, { action: "refill-envelope", addBudget }),
    resume: (id) => act(id, { action: "resume" }),
    async getLedger(id) {
      return (await apiJson<{ ledger: Hypothesis[] }>(`/api/tournaments/${id}/ledger`)).ledger;
    },
  };
}

export function tournamentClient(browseMode: boolean): TournamentClient {
  return browseMode ? demoClient() : realClient();
}
