// 서버 오케스트레이터 (ADR-038 결정 3·6) — server-side only. 데모용 runner.ts("use client", 동기
// localStorage, fetch /api)와 대칭인 실 유저 경로. 어댑터 3개(store·launcher·kpiSource)를 주입받아
// 라운드를 진행하며, cron 폴러(브라우저 없이 동작)와 API 라우트가 공유한다. 엔진(engine.ts) 판정·승격은
// 데모와 동일 함수를 그대로 쓴다 — 갈라지는 건 부작용(저장·게재·KPI)뿐.

import { geminiCreative } from "@/lib/gemini-creative";
import type { ObjectiveId } from "@entities/creative/options";
import type { TournamentStore, RoundLauncher, KpiSource } from "./adapters";
import {
  nextAxis,
  deriveAxis,
  buildChallenger,
  initialChampion,
  judgeRoundKpis,
  isEnvelopeExhausted,
  detectAnomaly,
  newTournamentId,
  roundCampaignId,
  MIN_ROUND_DAYS,
  type Tournament,
  type TourVariant,
  type TourRound,
  type TournamentDelivery,
  type SettleResult,
} from "./engine";

type CreativeGen = { headlines: string[]; primaryTexts: string[] };

// 데모 runner 의 fetch("/api/generate-creative") 대신 Gemini 직접 호출 — 서버엔 라우트 왕복이 불필요.
async function genCreative(t: Tournament): Promise<CreativeGen> {
  const res = await geminiCreative.generate({
    brand: t.brandDescription || t.productName,
    target: t.productDescription || t.productName,
    tone: t.tone,
    outcome: t.objective as ObjectiveId,
    product: { name: t.productName, description: t.productDescription || t.productName },
    variationIntensity: t.variationIntensity,
  });
  return { headlines: res.headlines, primaryTexts: res.primaryTexts };
}

// 실 게재 라운드의 경과일 — launchedAt 부터 now 까지(KST 무관, UTC 차분). 미게재면 0.
function elapsedDays(round: TourRound, nowMs: number): number {
  if (!round.launchedAt) return 0;
  const start = Date.parse(round.launchedAt);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 86400000));
}

export type ServerTournamentSetup = {
  brandProfileId: string;
  productId: string;
  productName: string;
  brandDescription?: string;
  productDescription?: string;
  tone: string;
  objective: string;
  mode: "manual-n" | "auto";
  maxRounds?: number;
  envelope?: { totalBudget?: number; targetDate?: string };
  dailyBudget: number;
  startingCtr: number;
  // 출발 챔피언 출처 (ADR-038 결정 7). existing = 실 캠페인 카피+실 CTR 즉시 확정, ai = Gemini 부트스트랩.
  championSource?: "ai" | "existing";
  startingChampion?: TourVariant;
  championSourceName?: string;
  delivery: TournamentDelivery; // 실 게재 봉투 — cron 이 세션 없이 게재·폴링하는 데 필수
};

export type ServerSettleResult =
  | { status: "no-active" }
  | { status: "insufficient" }
  | {
      status: "settled";
      round: TourRound;
      winnerIsB: boolean;
      badge: "winner" | "inconclusive";
      completed: boolean;
    };

export function createServerRunner(deps: {
  store: TournamentStore;
  launcher: RoundLauncher;
  kpiSource: KpiSource;
  now?: () => number; // 테스트 주입용 — 미지정 시 Date.now
}) {
  const { store, launcher, kpiSource } = deps;
  const now = deps.now ?? (() => Date.now());

  // 셋업 → 출발 챔피언 확보. existing = 즉시 확정, ai = Gemini 생성 후 검토 대기(championConfirmed=false).
  async function createTournament(setup: ServerTournamentSetup): Promise<string> {
    const id = newTournamentId();
    const fromExisting = setup.championSource === "existing" && !!setup.startingChampion;
    const draft: Tournament = {
      id,
      brandProfileId: setup.brandProfileId,
      productId: setup.productId || "manual",
      productName: setup.productName,
      brandDescription: setup.brandDescription,
      productDescription: setup.productDescription,
      tone: setup.tone,
      objective: setup.objective,
      mode: setup.mode,
      maxRounds: setup.maxRounds,
      envelope: setup.envelope,
      dailyBudget: setup.dailyBudget,
      champion: { headline: "", primaryText: "" },
      championCtr: setup.startingCtr,
      championSource: fromExisting ? "existing" : "ai",
      championSourceName: fromExisting ? setup.championSourceName : undefined,
      championConfirmed: fromExisting,
      axisCursor: 0,
      rounds: [],
      spentBudget: 0,
      status: "running",
      createdAt: new Date(now()).toISOString(),
      delivery: setup.delivery,
    };
    if (fromExisting) {
      draft.champion = setup.startingChampion!;
    } else {
      const gen = await genCreative(draft);
      draft.champion = initialChampion(gen);
    }
    await store.upsert(draft);
    return id;
  }

  async function regenerateChampion(id: string): Promise<TourVariant | null> {
    const t = await store.get(id);
    if (!t || t.championConfirmed) return null;
    const gen = await genCreative(t);
    t.champion = initialChampion(gen);
    await store.upsert(t);
    return t.champion;
  }

  async function confirmChampion(id: string, edited?: TourVariant): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    if (edited) t.champion = edited;
    t.championConfirmed = true;
    await store.upsert(t);
  }

  async function proposeChallenger(id: string): Promise<TourVariant | null> {
    const t = await store.get(id);
    if (!t || t.status === "completed" || t.rounds.some((r) => r.status === "running")) return null;
    const axis = nextAxis(t.axisCursor);
    const gen = await genCreative(t);
    t.pendingChallenger = buildChallenger(t.champion, axis, gen);
    await store.upsert(t);
    return t.pendingChallenger;
  }

  async function setManualChallenger(id: string, variant: TourVariant): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    t.pendingChallenger = variant;
    await store.upsert(t);
  }

  // 게재 결정 → pending 챌린저를 실 Meta A/B 게재. campaignId·adIds·launchedAt 을 라운드에 박아둔다.
  async function launchRound(id: string): Promise<TourRound | null> {
    const t = await store.get(id);
    if (!t || t.status === "completed" || t.rounds.some((r) => r.status === "running") || !t.pendingChallenger) {
      return null;
    }
    const index = t.rounds.length + 1;
    const round: TourRound = {
      index,
      axis: deriveAxis(t.champion, t.pendingChallenger),
      campaignId: roundCampaignId(t.id, index),
      champion: t.champion,
      challenger: t.pendingChallenger,
      fastForwardDays: 0,
      status: "running",
    };
    const { campaignId, adIds, adSetIds, studyId } = await launcher.launch(t, round);
    round.campaignId = campaignId;
    round.adIds = adIds;
    round.adSetIds = adSetIds;
    round.studyId = studyId;
    round.launchedAt = new Date(now()).toISOString();
    t.rounds = [...t.rounds, round];
    t.pendingChallenger = undefined;
    await store.upsert(t);
    return round;
  }

  async function endTournament(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    t.status = "completed";
    t.pendingChallenger = undefined;
    await store.upsert(t);
  }

  // cron 핵심 — 활성 라운드를 Meta KPI 로 결산. MIN_ROUND_DAYS 미달이면 insufficient(미종료, 다음 폴에 재시도).
  // settle 시 챔피언 승격 + 봉투 정지 체크. manual-n 은 봉투 소진 즉시 완료, auto 는 winner-handling 브레이크로 surface.
  async function pollAndSettle(id: string): Promise<ServerSettleResult> {
    const t = await store.get(id);
    if (!t) return { status: "no-active" };
    const r = t.rounds.find((x) => x.status === "running");
    if (!r) return { status: "no-active" };

    const kpis = await kpiSource.roundKpis(t, r);
    // ADR §4 정석 — ad study 의 Meta verdict 우선. 미확정(진행 중)이면 결산 보류, 다음 폴 재시도.
    // roundVerdict 미구현 어댑터(데모/폴백)는 엔진 z-검정으로 판정.
    let result: SettleResult;
    if (kpiSource.roundVerdict) {
      const mv = await kpiSource.roundVerdict(t, r, kpis);
      if (!mv) return { status: "insufficient" };
      result = { kpis, verdict: mv.verdict, rawWinner: mv.verdict.state === "winner" ? mv.winner : "A" };
    } else {
      result = judgeRoundKpis(kpis, elapsedDays(r, now()), t.objective);
      if (result.verdict.state === "insufficient") return { status: "insufficient" };
    }

    r.verdict = result.verdict;
    r.rawWinner = result.rawWinner;
    r.adKpis = result.kpis;
    r.status = "settled";

    const winnerIsB = result.rawWinner === "B";
    t.champion = winnerIsB ? r.challenger : r.champion;
    t.championCtr = winnerIsB ? result.verdict.ctrB : result.verdict.ctrA;
    t.axisCursor += 1;
    t.spentBudget += t.dailyBudget * MIN_ROUND_DAYS; // 실 게재 라운드당 최소 기간만큼 봉투 차감(보수적)

    const exhausted = isEnvelopeExhausted(t);
    if (t.mode === "manual-n" && exhausted) t.status = "completed";
    await store.upsert(t);

    return {
      status: "settled",
      round: r,
      winnerIsB,
      badge: result.verdict.state === "winner" ? "winner" : "inconclusive",
      completed: exhausted,
    };
  }

  // auto 무인 체인 — 결산 후 브레이크(봉투 소진·이상 신호) 없으면 다음 챌린저 자동 생성·게재.
  // cron 이 pollAndSettle → autoAdvance 순으로 호출. 챌린저 생성/게재 실패는 swallow(다음 폴에 재시도).
  async function autoAdvance(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t || t.mode !== "auto" || t.status === "completed") return;
    if (!t.championConfirmed) return;
    if (t.rounds.some((r) => r.status === "running")) return;
    if (isEnvelopeExhausted(t) || detectAnomaly(t)) return;
    try {
      if (!t.pendingChallenger) await proposeChallenger(id);
      await launchRound(id);
    } catch {
      // 무인 체인만 건너뛴다.
    }
  }

  async function discardPendingChallenger(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    t.pendingChallenger = undefined;
    await store.upsert(t);
  }

  async function resolveAnomaly(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    const last = t.rounds.filter((r) => r.status === "settled").at(-1);
    t.anomalyClearedRound = last?.index ?? 0;
    await store.upsert(t);
  }

  async function refillEnvelope(id: string, addBudget = 300000): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    const env = t.envelope ?? {};
    t.envelope = { ...env, totalBudget: (env.totalBudget ?? t.spentBudget) + addBudget };
    await store.upsert(t);
  }

  return {
    createTournament,
    regenerateChampion,
    confirmChampion,
    proposeChallenger,
    setManualChallenger,
    launchRound,
    endTournament,
    pollAndSettle,
    autoAdvance,
    discardPendingChallenger,
    resolveAnomaly,
    refillEnvelope,
  };
}

export type ServerRunner = ReturnType<typeof createServerRunner>;
