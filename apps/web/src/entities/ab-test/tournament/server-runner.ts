// 서버 오케스트레이터 (ADR-038 결정 3·6) — server-side only. 데모용 runner.ts("use client", 동기
// localStorage, fetch /api)와 대칭인 실 유저 경로. 어댑터 3개(store·launcher·kpiSource)를 주입받아
// 라운드를 진행하며, cron 폴러(브라우저 없이 동작)와 API 라우트가 공유한다. 엔진(engine.ts) 판정·승격은
// 데모와 동일 함수를 그대로 쓴다 — 갈라지는 건 부작용(저장·게재·KPI)뿐.

import { geminiCreative } from "@/lib/gemini-creative";
import type { ObjectiveId } from "@entities/creative/options";
import type { TournamentStore, RoundLauncher, KpiSource } from "./adapters";
import {
  deriveAxis,
  initialChampion,
  judgeRoundKpis,
  isEnvelopeExhausted,
  hasConverged,
  canAutoRefill,
  endCompletionReason,
  newTournamentId,
  roundCampaignId,
  MIN_ROUND_DAYS,
  type Tournament,
  type TourVariant,
  type TourRound,
  type TournamentDelivery,
  type TourEnvelope,
  type SettleResult,
} from "./engine";
import {
  deriveLedger,
  selectNextLever,
  summarizeLedger,
  buildHypothesis,
  buildLeverChallenger,
  resolveHypothesis,
} from "./hypothesis";

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
    prohibitedWords: t.prohibitedWords, // ADR-054 — 금칙어 구조 차단(생성 단계에서 배제)
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
  envelope?: TourEnvelope; // ADR-054/061 — 총예산·(선택)목표일·자동충전
  dailyBudget: number;
  startingCtr: number;
  // 출발 챔피언 출처 (ADR-038 결정 7). existing = 실 캠페인 카피+실 CTR 즉시 확정, ai = Gemini 부트스트랩.
  championSource?: "ai" | "existing";
  startingChampion?: TourVariant;
  championSourceName?: string;
  prohibitedWords?: string[]; // ADR-054 — 브랜드 금칙어. 챌린저 생성 프롬프트에 구조 주입
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
      mode: "auto",
      envelope: setup.envelope,
      dailyBudget: setup.dailyBudget,
      champion: { headline: "", primaryText: "" },
      championCtr: setup.startingCtr,
      championSource: fromExisting ? "existing" : "ai",
      championSourceName: fromExisting ? setup.championSourceName : undefined,
      championConfirmed: true, // ADR-054 — AI 부트스트랩·기존 광고 모두 자동 확정(예산만 사람)
      prohibitedWords: setup.prohibitedWords,
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

  // ADR-044/047 — Ledger 구동 가설 생성. 소유 유저의 같은 브랜드 토너먼트를 투영해 다음 레버를 고르고
  // (ⓐ재탕 회피 ⓑ미탐색 우선 ⓒ음성 가지치기) 가설 + 챌린저를 pending 으로 보관. 데모 runner 와 대칭.
  async function proposeChallenger(id: string): Promise<TourVariant | null> {
    const t = await store.get(id);
    if (!t || t.status === "completed" || t.rounds.some((r) => r.status === "running")) return null;
    const gen = await genCreative(t);
    const index = t.rounds.length + 1;
    const ctx = { productId: t.productId, objective: t.objective };
    const ownerKey = t.delivery?.ownerEmail;
    const ledger = ownerKey ? deriveLedger(await store.listByBrandOwner(t.brandProfileId, ownerKey)) : [];
    const lever = selectNextLever(ledger, ctx, index);
    const hasPrior = summarizeLedger(ledger, ctx).relevant.length > 0;
    t.pendingHypothesis = buildHypothesis({
      lever,
      ctx,
      rationaleSource: hasPrior ? "ledger" : "platform-prior",
      idSeed: `${t.id}_r${index}`,
    });
    t.pendingChallenger = buildLeverChallenger(t.champion, lever, gen);
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
      hypothesis: t.pendingHypothesis ? { ...t.pendingHypothesis, status: "testing" } : undefined, // ADR-044
    };
    const { campaignId, adIds, adSetIds, studyId } = await launcher.launch(t, round);
    round.campaignId = campaignId;
    round.adIds = adIds;
    round.adSetIds = adSetIds;
    round.studyId = studyId;
    round.launchedAt = new Date(now()).toISOString();
    t.rounds = [...t.rounds, round];
    t.pendingChallenger = undefined;
    t.pendingHypothesis = undefined;
    await store.upsert(t);
    return round;
  }

  async function endTournament(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    t.status = "completed";
    t.completionReason = endCompletionReason(t); // ADR-061
    t.pendingChallenger = undefined;
    await store.upsert(t);
  }

  // cron 핵심 — 활성 라운드를 Meta KPI 로 결산. MIN_ROUND_DAYS 미달이면 insufficient(미종료, 다음 폴에 재시도).
  // settle 시 챔피언 승격 + 봉투 정지 체크. ADR-054 — 봉투 소진은 winner-handling 브레이크로 surface(자동 완료 X).
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
    // ADR-044/047 — 가설 verdict 확정. resolved 가설은 토너먼트 jsonb 에 박혀 그대로 Ledger 투영 대상이 된다.
    if (r.hypothesis) {
      r.hypothesis = resolveHypothesis(r.hypothesis, result.verdict, result.rawWinner, new Date(now()).toISOString());
    }

    const winnerIsB = result.rawWinner === "B";
    t.champion = winnerIsB ? r.challenger : r.champion;
    t.championCtr = winnerIsB ? result.verdict.ctrB : result.verdict.ctrA;
    t.axisCursor += 1;
    t.spentBudget += t.dailyBudget * MIN_ROUND_DAYS; // 실 게재 라운드당 최소 기간만큼 봉투 차감(보수적)

    // ADR-061 — 챔피언 N회 연속 방어 = 수렴. 결산 직후 자동 완료(deriveBeat 무변경).
    if (hasConverged(t)) {
      t.status = "completed";
      t.completionReason = "converged";
    }

    const exhausted = t.status === "completed" || isEnvelopeExhausted(t); // ADR-054 — auto 는 자동 완료 X, winner-handling 으로 사람 대기
    await store.upsert(t);

    return {
      status: "settled",
      round: r,
      winnerIsB,
      badge: result.verdict.state === "winner" ? "winner" : "inconclusive",
      completed: exhausted,
    };
  }

  // auto 무인 체인 (ADR-054) — 봉투 미소진이면 다음 챌린저 자동 생성·게재. 금칙어 구조 차단·정체 자동 돌파라 정지 없음.
  // cron 이 pollAndSettle → autoAdvance 순으로 호출. 챌린저 생성 실패는 일시적(swallow·재시도),
  // 게재 실패는 split test 규칙 거절이라 사전 탐지 불가 → lastError 에 한국어로 박고 자동 진행 중단(ADR-053).
  async function autoAdvance(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t || t.status === "completed") return;
    if (t.lastError) return; // ADR-053 — 게재 실패로 멈춘 토너먼트는 사람이 손볼 때까지 자동 진행 안 함 (자동충전보다 먼저)
    if (!t.championConfirmed) return;
    if (t.rounds.some((r) => r.status === "running")) return;
    // ADR-061 — 봉투 소진 시 autoRefill opt-in & hardCap 미만이면 자동 충전. hardCap 도달이면 미충전 → winner-handling.
    if (isEnvelopeExhausted(t) && canAutoRefill(t)) {
      const env = t.envelope!;
      t.envelope = { ...env, totalBudget: (env.totalBudget ?? t.spentBudget) + env.autoRefill!.addBudget };
      await store.upsert(t);
    }
    if (isEnvelopeExhausted(t)) return;
    try {
      if (!t.pendingChallenger) await proposeChallenger(id);
    } catch {
      // 챌린저 생성(Gemini) 실패는 일시적 — 다음 폴에 재시도.
      return;
    }
    try {
      await launchRound(id);
    } catch (e) {
      // ADR-053 — Meta 가 split test 게재를 거절(예산·기간·목표). createSplitTestStudy 가 mapSplitTestError 로
      // 이미 한국어 Error 를 던진다. 저장 후 다음 폴부터 skip — 조용히 방치되지 않게 상세 배너로 surface.
      const fresh = await store.get(id);
      if (fresh) {
        fresh.lastError = e instanceof Error ? e.message : String(e);
        await store.upsert(fresh);
      }
    }
  }

  async function refillEnvelope(id: string, addBudget = 300000): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    const env = t.envelope ?? {};
    t.envelope = { ...env, totalBudget: (env.totalBudget ?? t.spentBudget) + addBudget };
    await store.upsert(t);
  }

  // ADR-053 복구 — 게재 실패로 멈춘 토너먼트(lastError)를 사람이 확인 후 재시도. lastError 제거만 하면
  // 다음 cron 폴이 autoAdvance 를 다시 태운다.
  async function resume(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t || !t.lastError) return;
    t.lastError = undefined;
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
    refillEnvelope,
    resume,
  };
}

export type ServerRunner = ReturnType<typeof createServerRunner>;
