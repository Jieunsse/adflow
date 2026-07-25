"use client";

// 토너먼트 오케스트레이션 — 엔진(tournament.ts) 위의 라운드 진행 primitive.
// /ab-tests/new 셋업·/ab-tests/[id] 상세·PresenterTournamentBar 가 공유한다.
// 챌린저 생성은 실제 Gemini(/api/generate-creative, browseMode 면 정적 응답), 판정·승격은 실제 엔진.
// mock 은 Meta 게재·시간 경과뿐.

import {
  getTournament,
  upsertTournament,
  newTournamentId,
  initialChampion,
  isEnvelopeExhausted,
  canAutoRefill,
  endCompletionReason,
  type Tournament,
  type TourVariant,
  type TourRound,
  type TourEnvelope,
  type VariationIntensity,
} from "./tournament";
import { selectNextLever, buildHypothesis, buildLeverChallenger, summarizeLedger } from "./hypothesis";
import { relevantLedger } from "./ledger";
import { applyLaunch, applySettle, type RoundSettleResult } from "./transitions";

export type { RoundSettleResult } from "./transitions";

type CreativeGen = { headlines: string[]; primaryTexts: string[] };

// 셋업에서 고른 브랜드/제품/톤 컨텍스트를 전부 주입해 Gemini 카피 생성. 챔피언·챌린저 공용.
async function genCreative(t: Tournament): Promise<CreativeGen> {
  const res = await fetch("/api/generate-creative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brand: t.brandDescription || t.productName,
      target: t.productDescription || t.productName,
      tone: t.tone,
      outcome: t.objective,
      product: { name: t.productName, description: t.productDescription || t.productName },
      variationIntensity: t.variationIntensity,
      prohibitedWords: t.prohibitedWords, // ADR-054 — 금칙어 구조 차단(생성 단계에서 배제)
    }),
  });
  if (!res.ok) throw new Error("gen failed");
  return (await res.json()) as CreativeGen;
}

export type TournamentSetup = {
  brandProfileId: string;
  productId: string;
  productName: string;
  brandDescription?: string;
  productDescription?: string;
  tone: string;
  objective: string;
  envelope?: TourEnvelope; // ADR-054 — 총예산·(선택)목표일. 소진 = winner-handling
  dailyBudget: number;
  startingCtr: number;
  // 출발 챔피언 출처. existing 이면 기존 광고 카피를 시드로 받아 즉시 확정, 생략 시 AI 부트스트랩.
  championSource?: "ai" | "existing";
  startingChampion?: TourVariant;
  championSourceName?: string;
  variationIntensity?: VariationIntensity;
  prohibitedWords?: string[]; // ADR-054 — 브랜드 금칙어. 챌린저 생성 프롬프트에 구조 주입
};

// 셋업 결정 → 출발 챔피언 확보. existing = 기존 광고 카피 즉시 확정, ai = Gemini 생성 후 검토 대기.
export async function startTournament(setup: TournamentSetup): Promise<string> {
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
    variationIntensity: setup.variationIntensity,
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
    createdAt: new Date().toISOString(),
  };
  if (fromExisting) {
    draft.champion = setup.startingChampion!;
  } else {
    const gen = await genCreative(draft);
    draft.champion = initialChampion(gen);
  }
  upsertTournament(draft);
  return id;
}

// 챔피언 검토 중 "다시 생성" — AI 가 출발 광고를 새로 제안 (아직 미승인 유지).
export async function regenerateChampion(id: string): Promise<TourVariant | null> {
  const t = getTournament(id);
  if (!t || t.championConfirmed) return null;
  const gen = await genCreative(t);
  t.champion = initialChampion(gen);
  upsertTournament(t);
  return t.champion;
}

// 챔피언 검토 결정 → 출발 광고 확정 (수정본 있으면 반영).
export function confirmChampion(id: string, edited?: TourVariant): void {
  const t = getTournament(id);
  if (!t) return;
  if (edited) t.champion = edited;
  t.championConfirmed = true;
  upsertTournament(t);
}

// AI 챌린저 제안 (ADR-044) — Ledger 를 읽어 다음 레버를 고르고 가설을 세운 뒤 챌린저 생성, pending 으로 보관.
export async function proposeChallenger(id: string): Promise<TourVariant | null> {
  const t = getTournament(id);
  if (!t || t.status === "completed" || t.rounds.some((r) => r.status === "running")) return null;
  const gen = await genCreative(t);
  const index = t.rounds.length + 1;
  const ctx = { productId: t.productId, objective: t.objective };
  const ledger = relevantLedger(t.brandProfileId, ctx);
  const lever = selectNextLever(ledger, ctx, index);
  const hasPrior = summarizeLedger(ledger, ctx).relevant.length > 0;
  t.pendingHypothesis = buildHypothesis({
    lever,
    ctx,
    rationaleSource: hasPrior ? "ledger" : "platform-prior",
    idSeed: `${t.id}_r${index}`,
  });
  t.pendingChallenger = buildLeverChallenger(t.champion, lever, gen);
  upsertTournament(t);
  return t.pendingChallenger;
}

// 직접 작성 결정 — 사용자가 손본 챌린저로 pending 교체.
export function setManualChallenger(id: string, variant: TourVariant): void {
  const t = getTournament(id);
  if (!t) return;
  t.pendingChallenger = variant;
  upsertTournament(t);
}

// 게재 결정 → pending 챌린저를 라운드로 확정 게재. pending 없으면 null. (순수 로직 = transitions.applyLaunch)
export function launchRound(id: string): TourRound | null {
  const t = getTournament(id);
  if (!t) return null;
  const { t: nt, round } = applyLaunch(t);
  if (round) upsertTournament(nt);
  return round;
}

// 조기 종료 결정 — 봉투 소진 전이라도 사용자가 토너먼트를 끝냄 (최종 챔피언 확정).
export function endTournament(id: string): void {
  const t = getTournament(id);
  if (!t) return;
  t.status = "completed";
  t.completionReason = endCompletionReason(t); // ADR-061
  t.pendingChallenger = undefined;
  upsertTournament(t);
}

// 활성 라운드를 days 만큼 경과시킨 뒤 결산 + 챔피언 승격 + 봉투 정지 체크. (순수 로직 = transitions.applySettle)
// days=0 이면 현재 누적 fastForwardDays 로 판정 (빨리감기 후 결산용).
export function settleActiveRound(id: string, days = 0): RoundSettleResult {
  const t = getTournament(id);
  if (!t) return { status: "no-active" };
  const { t: nt, result } = applySettle(t, days);
  if (result.status !== "no-active") upsertTournament(nt); // insufficient 도 누적 ff 저장
  return result;
}

/* ─── ADR-054 무인 루프 — 예산 소진에서만 멈춤 ──────────────────── */

// auto 무인 체인: 봉투 미소진이면 다음 챌린저를 자동 생성·게재. 금칙어는 생성 단계에서 차단,
// 정체는 proposeChallenger 의 selectNextLever 가 다른 레버로 자동 돌파 — 멈추지 않는다.
export async function autoAdvanceTournament(id: string): Promise<void> {
  const t = getTournament(id);
  if (!t || t.status === "completed") return;
  if (!t.championConfirmed) return; // 출발 챔피언 게이트 (existing 1회 확인)
  if (t.rounds.some((r) => r.status === "running")) return; // 이미 라이브
  if (isEnvelopeExhausted(t) && canAutoRefill(t)) refillEnvelope(id, t.envelope!.autoRefill!.addBudget); // ADR-061
  if (isEnvelopeExhausted(getTournament(id) ?? t)) return; // 봉투 소진(충전 후 재평가) — winner-handling 사람 대기
  try {
    if (!t.pendingChallenger) await proposeChallenger(id); // 사람이 손본 챌린저가 있으면 그대로, 없으면 Gemini 생성
    launchRound(id); // pending → 라운드 게재
  } catch {
    // 챌린저 생성 실패 시 무인 체인만 건너뛴다 (다음 빨리감기에 재시도).
  }
}

// winner 처리 "봉투 리필" — 총예산을 늘려 무인 루프 재개.
export function refillEnvelope(id: string, addBudget = 300000): void {
  const t = getTournament(id);
  if (!t) return;
  const env = t.envelope ?? {};
  t.envelope = { ...env, totalBudget: (env.totalBudget ?? t.spentBudget) + addBudget };
  upsertTournament(t);
}
