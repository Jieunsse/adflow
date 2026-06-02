// PRD 가설 기반 A/B (ADR-044) — AI 가설 생성기의 결정 코어 (순수 함수). buildChallenger/nextAxis/AXIS_CYCLE 대체.
// Ledger + 목표를 읽어 ⓐ재탕 회피 ⓑ미탐색 우선 ⓒ음성 가지치기로 다음 레버를 고르고, 근거를 강제해 가설을 만든다.
// "use client" 없음 — 서버 데모 라우트(transitions)가 import. 실 유저 경로의 Gemini suggestHypothesis 는 후속.

import {
  ALL_LEVERS,
  COPY_LEVER_IDS,
  NON_COPY_LEVER_IDS,
  LEVER_HYPOTHESIS,
  leverSwapsHeadline,
  type Lever,
} from "./lever";
import { tourMetricSpec } from "./objective-metric";
import { recommendedHooks, type ObjectiveId } from "@entities/creative/options";
import { seededUnit, type Hypothesis, type HypothesisVerdict, type RoundVerdict, type TourVariant, type Tournament } from "./engine";

export type LedgerContext = { productId: string; personaId?: string; objective: string };

// ADR-047 — 실유저 Ledger 투영. resolved 가설은 이미 tournaments.data 의 rounds[].hypothesis 에 있으므로
// 별도 테이블 없이 토너먼트 묶음에서 평탄화해 Ledger 로 도출한다. 데모(localStorage ledger.ts)와 달리 미러 없음.
export function deriveLedger(tournaments: Tournament[]): Hypothesis[] {
  const out: Hypothesis[] = [];
  for (const t of tournaments)
    for (const r of t.rounds)
      if (r.hypothesis?.status === "resolved") out.push(r.hypothesis);
  return out;
}

type CreativeGen = { headlines: string[]; primaryTexts: string[] };

// contextTags 로 현재 제품·목표(·페르소나) 관련 가설만 거른다 — Ledger 가중/필터 키 (PRD 데이터 모델).
export function filterByContext(entries: Hypothesis[], ctx: LedgerContext): Hypothesis[] {
  return entries.filter(
    (e) =>
      e.contextTags.productId === ctx.productId &&
      e.contextTags.objective === ctx.objective &&
      (ctx.personaId == null || e.contextTags.personaId == null || e.contextTags.personaId === ctx.personaId),
  );
}

// 2단 사다리 (ADR-050) — Ledger 를 제품/브랜드 두 층으로 분리한다. product=제품+목표(직접 증거),
// brand=같은 브랜드 버킷 안 목표만 매칭한 타 제품 학습(설득 각도는 제품을 가로질러 일반화). 편향원 입력.
export function ledgerLadder(
  entries: Hypothesis[],
  ctx: LedgerContext,
): { product: Hypothesis[]; brand: Hypothesis[] } {
  return {
    product: filterByContext(entries, ctx),
    brand: entries.filter(
      (e) => e.contextTags.objective === ctx.objective && e.contextTags.productId !== ctx.productId,
    ),
  };
}

export type LedgerSummary = {
  confirmed: Set<Lever>;
  refuted: Set<Lever>;
  tested: Set<Lever>;
  relevant: Hypothesis[];
};

export function summarizeLedger(entries: Hypothesis[], ctx: LedgerContext): LedgerSummary {
  const relevant = filterByContext(entries, ctx);
  const confirmed = new Set<Lever>();
  const refuted = new Set<Lever>();
  const tested = new Set<Lever>();
  for (const h of relevant) {
    if (h.status !== "resolved") continue;
    tested.add(h.lever);
    if (h.verdict === "confirmed") confirmed.add(h.lever);
    else if (h.verdict === "refuted") refuted.add(h.lever);
  }
  return { confirmed, refuted, tested, relevant };
}

// 후보 레버 풀 — 목표 추천 카피훅을 앞에, 나머지 카피 + 비카피. image-scene 은 자동 순회 제외(PRD §8 후속).
export function leverPool(objective: string): Lever[] {
  let recommended: Lever[] = [];
  try {
    recommended = recommendedHooks(objective as ObjectiveId);
  } catch {
    recommended = ["number", "trust", "benefit"];
  }
  const seen = new Set<Lever>(recommended);
  const restCopy = COPY_LEVER_IDS.filter((l) => !seen.has(l));
  const nonCopy = NON_COPY_LEVER_IDS.filter((l) => l !== "image-scene");
  return [...recommended, ...restCopy, ...nonCopy];
}

// 다음 레버 선택 — ⓒ 음성 가지치기(refuted 제거) → ⓑ 미탐색 우선 → ⓐ 재탕 회피(confirmed 후순위).
// seed 로 결정적 — 같은 (ledger, ctx, seed)면 항상 같은 레버.
export function selectNextLever(entries: Hypothesis[], ctx: LedgerContext, seed: number): Lever {
  const { confirmed, refuted, tested } = summarizeLedger(entries, ctx);
  const pool = leverPool(ctx.objective).filter((l) => !refuted.has(l)); // ⓒ
  const unexplored = pool.filter((l) => !tested.has(l)); // ⓑ
  const candidates = unexplored.length ? unexplored : pool.filter((l) => !confirmed.has(l)); // ⓐ
  const final = candidates.length ? candidates : pool.length ? pool : ALL_LEVERS;
  return final[Math.abs(seed) % final.length];
}

// 선택한 레버 + 맥락 → 가설(proposed). 근거 강제 — rationale + rationaleSource 동반.
export function buildHypothesis(opts: {
  lever: Lever;
  ctx: LedgerContext;
  rationaleSource: Hypothesis["rationaleSource"];
  idSeed: string;
}): Hypothesis {
  const spec = tourMetricSpec(opts.ctx.objective);
  const tpl = LEVER_HYPOTHESIS[opts.lever];
  return {
    id: `hyp_${opts.idSeed}`,
    lever: opts.lever,
    statement: tpl.claim.replace("{metric}", spec.rateLabel),
    predictedMetric: spec.rateLabel,
    predictedDirection: spec.higherBetter ? "up" : "down",
    rationale: tpl.rationale,
    rationaleSource: opts.rationaleSource,
    contextTags: { productId: opts.ctx.productId, personaId: opts.ctx.personaId, objective: opts.ctx.objective },
    status: "proposed",
  };
}

// 레버에 맞춰 챌린저 변형 구성 — 단일 가설이 건드리는 슬롯을 묶음 교체(헤드라인/카피, image-scene 은 데모 제외).
export function buildLeverChallenger(champion: TourVariant, lever: Lever, gen: CreativeGen): TourVariant {
  if (leverSwapsHeadline(lever)) {
    const h = gen.headlines.find((x) => x.trim() && x.trim() !== champion.headline.trim()) ?? gen.headlines[0] ?? champion.headline;
    return { ...champion, headline: h };
  }
  const t = gen.primaryTexts.find((x) => x.trim() && x.trim() !== champion.primaryText.trim()) ?? gen.primaryTexts[0] ?? champion.primaryText;
  return { ...champion, primaryText: t };
}

// 데모 전용 — 레버별 결과 authoring (PRD §2.1.6 반증 연출). 특정 레버는 이 브랜드에 역효과로 떨어뜨려
// 음성 학습("긴박감 반증 → 다음 가설 회피")을 캐스케이드 한 화면에 시연한다. 실 경로는 Meta 실측이라 미사용.
//   refuting(rush·surprise) → factor<1 (챔피언 유의 방어 = 반증) / strong(trust·number·proof) → 강한 lift = 입증
//   그 외 → near-tie = 미결 경향. campaignId 시드로 라운드별 미세 분산.
const DEMO_REFUTING_LEVERS = new Set<Lever>(["rush", "surprise"]);
const DEMO_STRONG_LEVERS = new Set<Lever>(["trust", "number", "proof", "benefit"]);
export function demoLeverFactor(lever: Lever, campaignId: string): number {
  const j = seededUnit(campaignId + "lf");
  if (DEMO_REFUTING_LEVERS.has(lever)) return 0.8 + j * 0.06; // 0.80~0.86 → 챔피언 유의 방어
  if (DEMO_STRONG_LEVERS.has(lever)) return 1.16 + j * 0.12; // 강한 lift
  return 0.985 + j * 0.05; // near-tie → inconclusive 경향
}

// 결산 결과 → 가설 verdict 매핑. 챌린저 유의 승격=입증 / 챔피언 유의 방어=반증 / 그 외=미결. 3종 모두 Ledger 적재.
export function resolveHypothesis(
  h: Hypothesis,
  verdict: RoundVerdict,
  rawWinner: "A" | "B",
  resolvedAt: string,
): Hypothesis {
  const v: HypothesisVerdict =
    verdict.state === "winner" ? (rawWinner === "B" ? "confirmed" : "refuted") : "inconclusive";
  const spec = tourMetricSpec(h.contextTags.objective);
  // effectSize = 챌린저가 챔피언 대비 결정 지표를 얼마나 개선했는지(%). rate=높을수록·cpm=낮을수록 개선.
  const a = verdict.ctrA;
  const b = verdict.ctrB;
  const rawLift = a > 0 ? ((b - a) / a) * 100 : 0;
  const effectSize = Math.round((spec.higherBetter ? rawLift : -rawLift) * 10) / 10;
  return { ...h, status: "resolved", verdict: v, effectSize, resolvedAt };
}
