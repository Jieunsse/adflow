// 실 유저 토너먼트 생성 — server-side only.
//
// 여기 남은 것은 **생성과 챔피언 카피 뽑기뿐**이다. 판정·게재·자동 진행은 Java 로 갔고, 사람이 누르는
// 편집(챔피언 확정·수동 챌린저·봉투 충전·복구·종료)도 Spring 의 좁은 엔드포인트로 갔다 — 애그리거트를
// 통째로 다시 저장하면 낙관적 락을 지나가서 폴러가 방금 쓴 결과를 덮을 수 있기 때문이다.
//
// 생성만 upsert 로 남는다. 새 id 라 덮을 것이 없다.

import { geminiCreative } from "@/lib/gemini-creative";
import type { ObjectiveId } from "@entities/creative/options";
import type { TournamentStore } from "./adapters";
import {
  initialChampion,
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

  // 셋업 → 출발 챔피언 확보. existing = 실 카피 그대로, ai = Gemini 부트스트랩.
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
      draft.champion = initialChampion(await genCreative(draft));
    }
    await store.upsert(draft);
    return id;
  }

  // 확정 전 AI 챔피언 다시 뽑기 — 생성만 여기서 하고 저장은 Spring 이 한다.
  async function regenerateChampion(t: Tournament): Promise<TourVariant> {
    return initialChampion(await genCreative(t));
  }

  return { createTournament, regenerateChampion };
}

export type ServerRunner = ReturnType<typeof createServerRunner>;
