// 실 유저 토너먼트 편집 — server-side only. 세션이 있어야 하는 것만 남았다.
//
// 단계 6 — **판정·게재·자동 진행은 여기 없다.** 라운드를 만드는 일은 전부 Java 가 소유한다
// (Spring 폴러 + /internal/tournaments/{id}/advance). 실제 광고가 만들어지는 경로를 두 곳에 두면
// 사람이 누른 라운드와 폴러가 띄운 라운드가 다른 규칙으로 만들어진다.
//
// 남은 것은 챔피언 확정·재생성·수동 챌린저·봉투 충전·복구 — 전부 저장만 하는 편집이다.

import { geminiCreative } from "@/lib/gemini-creative";
import type { ObjectiveId } from "@entities/creative/options";
import type { TournamentStore } from "./adapters";
import {
  initialChampion,
  endCompletionReason,
  newTournamentId,
  type Tournament,
  type TourVariant,
  type TournamentDelivery,
  type TourEnvelope,
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
    prohibitedWords: t.prohibitedWords, // ADR-054 — 금칙어 구조 차단(생성 단계에서 배제)
  });
  return { headlines: res.headlines, primaryTexts: res.primaryTexts };
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
  delivery: TournamentDelivery; // 실 게재 봉투 — 폴러가 세션 없이 게재·폴링하는 데 필수
};

export function createServerRunner(deps: {
  store: TournamentStore;
  now?: () => number; // 테스트 주입용 — 미지정 시 Date.now
}) {
  const { store } = deps;
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

  async function setManualChallenger(id: string, variant: TourVariant): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    t.pendingChallenger = variant;
    await store.upsert(t);
  }

  async function endTournament(id: string): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    t.status = "completed";
    t.completionReason = endCompletionReason(t); // ADR-061
    t.pendingChallenger = undefined;
    await store.upsert(t);
  }

  async function refillEnvelope(id: string, addBudget = 300000): Promise<void> {
    const t = await store.get(id);
    if (!t) return;
    const env = t.envelope ?? {};
    t.envelope = { ...env, totalBudget: (env.totalBudget ?? t.spentBudget) + addBudget };
    await store.upsert(t);
  }

  // ADR-053 복구 — 게재 실패로 멈춘 토너먼트(lastError)를 사람이 확인 후 재시도. lastError 제거만 하면
  // 다음 폴에서 Spring 이 자동 진행을 다시 태운다.
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
    setManualChallenger,
    endTournament,
    refillEnvelope,
    resume,
  };
}

export type ServerRunner = ReturnType<typeof createServerRunner>;
