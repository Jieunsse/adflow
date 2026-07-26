// 골든 픽스처 — TS 엔진과 Java 엔진이 **같은 파일**을 읽어 같은 답을 내는지 지킨다 (설계 §8).
//
// 둘러보기는 TS 엔진으로 돌고 실사용 판정은 Java 엔진이 소유한다(단계 5). 두 엔진이 상시 이중화되므로
// 규칙을 한쪽만 고치면 둘러보기와 실사용의 판정이 갈린다 — 그 드리프트를 여기서 잡는다.
//
// 기대값은 손으로 적은 게 아니라 이 엔진에서 떠낸 것이다. 즉 이 파일의 역할은 "정답 증명"이 아니라
// **잠금**이다. 엔진을 의도적으로 바꿨다면 픽스처를 다시 떠야 하고, 그때 Java 도 같이 깨진다.
//
// 대응 Java: apps/api/src/test/java/ai/adflow/api/tournament/engine/GoldenFixtureTest.java

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  confidenceFromCountTest,
  confidenceFromZTest,
  championDefendStreak,
  canAutoRefill,
  deriveAxis,
  deriveBeat,
  endCompletionReason,
  hasConverged,
  isEnvelopeExhausted,
  judgeRoundKpis,
  nextAxis,
  roundAdKpis,
  roundCampaignId,
  seededUnit,
  settleRound,
  type Tournament,
  type TourRound,
} from "./engine";
import {
  buildHypothesis,
  demoLeverFactor,
  leverPool,
  resolveHypothesis,
  selectNextLever,
  summarizeLedger,
} from "./hypothesis";
import { ALL_LEVERS, isCopyLever, leverLabel, leverSwapsHeadline, type Lever } from "./lever";
import { tourMetricSpec } from "./objective-metric";

const DIR = join(__dirname, "../../../../../../packages/contracts/fixtures/tournament");

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8")) as T;
}

// Java 의 Math.exp 와 V8 의 Math.exp 는 마지막 ulp 가 다를 수 있다. 정확 일치를 요구하면
// 두 엔진이 실제로는 같은데도 CI 가 흔들린다.
const EPSILON = 1e-9;

type Case<I, E> = { name: string; input: I; expected: E };

describe("골든 픽스처 — seededUnit", () => {
  const f = fixture<{ seededUnit: Case<{ seed: string; index: number }, number>[] }>("seeded-unit");

  // 결정성의 뿌리. 이게 갈라지면 시드 KPI 전부가 갈라지므로 맨 먼저 실패해야 한다.
  it.each(f.seededUnit)("$name", ({ input, expected }) => {
    expect(seededUnit(input.seed, input.index)).toBe(expected);
  });
});

describe("골든 픽스처 — 판정 코어", () => {
  type Kpi = { ctr: number; impressions: number; clicks: number; spend: number };
  const f = fixture<{
    judgeRoundKpis: Case<{ kpis: [Kpi, Kpi]; elapsedDays: number; objective: string }, unknown>[];
    confidenceFromZTest: Case<{ a: Kpi; b: Kpi }, number>[];
    confidenceFromCountTest: Case<{ impA: number; impB: number }, number>[];
  }>("judge-round");

  it.each(f.judgeRoundKpis)("judgeRoundKpis — $name", ({ input, expected }) => {
    expect(judgeRoundKpis(input.kpis, input.elapsedDays, input.objective)).toEqual(expected);
  });

  it.each(f.confidenceFromZTest)("confidenceFromZTest — $name", ({ input, expected }) => {
    expect(confidenceFromZTest(input.a, input.b)).toBeCloseTo(expected, 9);
  });

  it.each(f.confidenceFromCountTest)("confidenceFromCountTest — $name", ({ input, expected }) => {
    expect(confidenceFromCountTest(input.impA, input.impB)).toBeCloseTo(expected, 9);
  });
});

describe("골든 픽스처 — 시드 KPI 생성기", () => {
  type RoundInput = { index: number; campaignId: string; fastForwardDays: number };
  type KpiInput = {
    round: RoundInput;
    championCtr: number;
    dailyBudget: number;
    factorOverride: number | null;
    objective: string;
  };
  const f = fixture<{
    roundAdKpis: Case<KpiInput, unknown>[];
    settleRound: Case<KpiInput, unknown>[];
    roundCampaignId: Case<{ tournamentId: string; index: number }, string>[];
  }>("round-kpis");

  // 픽스처는 판정에 쓰이는 세 필드만 담는다. 나머지는 결과에 영향이 없다.
  const asRound = (r: RoundInput): TourRound => ({
    index: r.index,
    axis: "headline",
    campaignId: r.campaignId,
    champion: { headline: "챔피언", primaryText: "챔피언 카피" },
    challenger: { headline: "챌린저", primaryText: "챌린저 카피" },
    fastForwardDays: r.fastForwardDays,
    status: "running",
  });

  it.each(f.roundAdKpis)("roundAdKpis — $name", ({ input, expected }) => {
    expect(
      roundAdKpis(
        asRound(input.round),
        input.championCtr,
        input.dailyBudget,
        input.factorOverride ?? undefined,
        input.objective,
      ),
    ).toEqual(expected);
  });

  it.each(f.settleRound)("settleRound — $name", ({ input, expected }) => {
    expect(
      settleRound(
        asRound(input.round),
        input.championCtr,
        input.dailyBudget,
        input.factorOverride ?? undefined,
        input.objective,
      ),
    ).toEqual(expected);
  });

  it.each(f.roundCampaignId)("roundCampaignId — $name", ({ input, expected }) => {
    expect(roundCampaignId(input.tournamentId, input.index)).toBe(expected);
  });
});

describe("골든 픽스처 — 상태 판정", () => {
  type Variant = { headline: string; primaryText: string; imageUrl?: string };
  const f = fixture<{
    cases: Case<Tournament, Record<string, unknown>>[];
    deriveAxis: Case<{ champion: Variant; challenger: Variant }, string>[];
    nextAxis: Case<{ cursor: number }, string>[];
  }>("tournament-state");

  it.each(f.cases)("$name", ({ input, expected }) => {
    expect({
      deriveBeat: deriveBeat(input),
      championDefendStreak: championDefendStreak(input),
      hasConverged: hasConverged(input),
      isEnvelopeExhausted: isEnvelopeExhausted(input),
      canAutoRefill: canAutoRefill(input),
      endCompletionReason: endCompletionReason(input),
    }).toEqual(expected);
  });

  it.each(f.deriveAxis)("$name", ({ input, expected }) => {
    expect(deriveAxis(input.champion, input.challenger)).toBe(expected);
  });

  it.each(f.nextAxis)("nextAxis — $name", ({ input, expected }) => {
    expect(nextAxis(input.cursor)).toBe(expected);
  });
});

describe("골든 픽스처 — 가설 결정", () => {
  const f = fixture<{
    selectNextLever: Case<{ entries: unknown[]; ctx: never; seed: number }, string>[];
    leverPool: Case<{ objective: string }, string[]>[];
    summarizeLedger: Case<{ entries: unknown[]; ctx: never }, Record<string, string[]>>[];
    buildHypothesis: Case<{ lever: Lever; ctx: never; rationaleSource: never; idSeed: string }, unknown>[];
    resolveHypothesis: Case<{ hypothesis: never; verdict: never; rawWinner: "A" | "B"; resolvedAt: string }, unknown>[];
    demoLeverFactor: Case<{ lever: Lever; campaignId: string }, number>[];
    leverMeta: Case<{ lever: Lever }, { label: string; isCopy: boolean; swapsHeadline: boolean }>[];
    tourMetricSpec: Case<{ objective: string }, Record<string, unknown>>[];
  }>("hypothesis");

  // 추천 3훅의 순서까지 계약이다 — 목표별로 풀 전체를 박아 Java 의 추천 표 드리프트를 잡는다.
  it.each(f.leverPool)("leverPool — $name", ({ input, expected }) => {
    expect(leverPool(input.objective)).toEqual(expected);
  });

  it.each(f.selectNextLever)("selectNextLever — $name", ({ input, expected }) => {
    expect(selectNextLever(input.entries as never, input.ctx, input.seed)).toBe(expected);
  });

  it.each(f.summarizeLedger)("summarizeLedger — $name", ({ input, expected }) => {
    const s = summarizeLedger(input.entries as never, input.ctx);
    expect({
      confirmed: [...s.confirmed].sort(),
      refuted: [...s.refuted].sort(),
      tested: [...s.tested].sort(),
      relevantIds: s.relevant.map((h) => h.id).sort(),
    }).toEqual(expected);
  });

  it.each(f.buildHypothesis)("buildHypothesis — $name", ({ input, expected }) => {
    expect(buildHypothesis(input)).toEqual(expected);
  });

  it.each(f.resolveHypothesis)("resolveHypothesis — $name", ({ input, expected }) => {
    expect(
      resolveHypothesis(input.hypothesis, input.verdict, input.rawWinner, input.resolvedAt),
    ).toEqual(expected);
  });

  it.each(f.demoLeverFactor)("demoLeverFactor — $name", ({ input, expected }) => {
    expect(demoLeverFactor(input.lever, input.campaignId)).toBeCloseTo(expected, 9);
  });

  it.each(f.leverMeta)("leverMeta — $name", ({ input, expected }) => {
    expect({
      label: leverLabel(input.lever),
      isCopy: isCopyLever(input.lever),
      swapsHeadline: leverSwapsHeadline(input.lever),
    }).toEqual(expected);
  });

  it.each(f.tourMetricSpec)("tourMetricSpec — $name", ({ input, expected }) => {
    const s = tourMetricSpec(input.objective);
    expect({
      id: s.id,
      kind: s.kind,
      rateLabel: s.rateLabel,
      seedDefault: s.seedDefault,
      higherBetter: s.higherBetter,
      leadEpsilon: s.leadEpsilon,
    }).toEqual(expected);
  });

  it("픽스처가 모든 레버를 덮는다", () => {
    // 레버가 추가되면 픽스처를 다시 떠야 한다 — 안 그러면 새 레버가 검증 없이 지나간다.
    expect(f.demoLeverFactor.map((c) => c.input.lever).sort()).toEqual([...ALL_LEVERS].sort());
  });
});

describe("골든 픽스처 자체", () => {
  it("케이스 수가 줄지 않았어요", () => {
    // 픽스처를 다시 뜨다가 케이스를 잃어버리는 사고를 막는다.
    const counts = {
      seededUnit: fixture<{ seededUnit: unknown[] }>("seeded-unit").seededUnit.length,
      judge: fixture<{ judgeRoundKpis: unknown[] }>("judge-round").judgeRoundKpis.length,
      kpis: fixture<{ roundAdKpis: unknown[] }>("round-kpis").roundAdKpis.length,
      state: fixture<{ cases: unknown[] }>("tournament-state").cases.length,
      lever: fixture<{ selectNextLever: unknown[] }>("hypothesis").selectNextLever.length,
    };
    expect(counts).toEqual({ seededUnit: 12, judge: 17, kpis: 10, state: 17, lever: 180 });
  });
});

// EPSILON 은 Java 쪽과 같은 값을 쓴다는 표시로 남긴다(toBeCloseTo 자릿수와 짝).
void EPSILON;
