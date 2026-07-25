import { describe, it, expect } from "vitest";
import { aggregateByLever, deriveLearningHeadline } from "./ledger-view";
import type { Hypothesis } from "../engine";
import type { Lever } from "../lever";

let n = 0;
function h(
  lever: Lever,
  verdict: Hypothesis["verdict"],
  effectSize?: number,
  opts: { metric?: string; productId?: string } = {},
): Hypothesis {
  return {
    id: `h_${lever}_${n++}`,
    lever,
    statement: "s",
    predictedMetric: opts.metric ?? "CTR",
    predictedDirection: "up",
    rationale: "r",
    rationaleSource: "ledger",
    contextTags: { productId: opts.productId ?? "p1", objective: "traffic" },
    status: "resolved",
    verdict,
    effectSize,
  };
}

describe("aggregateByLever", () => {
  it("순입증 → 통함, 순반증 → 안통함, 동률·미결 → 중립", () => {
    const aggs = aggregateByLever([
      h("benefit", "confirmed", 20),
      h("benefit", "confirmed", 14),
      h("rush", "refuted", -12),
      h("story", "confirmed", 10),
      h("story", "refuted", -8),
      h("number", "inconclusive"),
    ]);
    const by = Object.fromEntries(aggs.map((a) => [a.lever, a.klass]));
    expect(by.benefit).toBe("works"); // 입증 2 > 반증 0
    expect(by.rush).toBe("backfires"); // 반증 1 > 입증 0
    expect(by.story).toBe("neutral"); // 1:1 동률
    expect(by.number).toBe("neutral"); // 미결만
  });

  it("입증 수 > 반증 수면 통함", () => {
    const [agg] = aggregateByLever([
      h("trust", "confirmed", 20),
      h("trust", "confirmed", 16),
      h("trust", "refuted", -5),
    ]);
    expect(agg.klass).toBe("works");
    expect(agg.confirmed).toBe(2);
    expect(agg.refuted).toBe(1);
    expect(agg.total).toBe(3);
    expect(agg.avgLift).toBe(18); // (20+16)/2
  });

  it("resolved 0건 레버는 제외(proposed/testing 무시)", () => {
    const aggs = aggregateByLever([
      { ...h("trust", undefined), status: "proposed", verdict: undefined },
      h("rush", "confirmed", 10),
    ]);
    expect(aggs.map((a) => a.lever)).toEqual(["rush"]);
  });

  it("정렬: 통함 → 중립 → 안통함, 그룹 내 |lift| 큰 순", () => {
    const aggs = aggregateByLever([
      h("trust", "confirmed", 10),
      h("benefit", "confirmed", 30),
      h("number", "inconclusive"),
      h("rush", "refuted", -25),
      h("surprise", "refuted", -5),
    ]);
    expect(aggs.map((a) => a.lever)).toEqual(["benefit", "trust", "number", "rush", "surprise"]);
  });

  it("단일 지표면 그 라벨, 2종 이상 혼합이면 '목표'", () => {
    const [single] = aggregateByLever([h("trust", "confirmed", 10, { metric: "CTR" })]);
    expect(single.liftMetricLabel).toBe("CTR");

    const [mixed] = aggregateByLever([
      h("trust", "confirmed", 10, { metric: "CTR" }),
      h("trust", "confirmed", 20, { metric: "CPM" }),
    ]);
    expect(mixed.liftMetricLabel).toBe("목표");
  });

  it("안통함의 lift 는 반증 건들의 effectSize 평균(음수)", () => {
    const [agg] = aggregateByLever([
      h("rush", "refuted", -12),
      h("rush", "refuted", -8),
    ]);
    expect(agg.klass).toBe("backfires");
    expect(agg.avgLift).toBe(-10);
  });
});

describe("deriveLearningHeadline", () => {
  it("resolved 0건 → null", () => {
    expect(deriveLearningHeadline([])).toBeNull();
  });

  it("1위 통함 레버를 문장으로 — 라벨·지표·검증 수 포함", () => {
    const line = deriveLearningHeadline([
      h("trust", "confirmed", 18),
      h("trust", "confirmed", 18),
      h("rush", "refuted", -12),
    ]);
    expect(line).toContain("가장 잘 통해요");
    expect(line).toContain("CTR 평균 +18%");
    expect(line).toContain("2번 검증");
  });

  it("통함 없고 안통함만일 때 역효과 표현", () => {
    const line = deriveLearningHeadline([h("rush", "refuted", -12)]);
    expect(line).toContain("뚜렷하게 통한 방식이 없어요");
    expect(line).toContain("역효과");
  });

  it("중립만일 때 결론 보류 표현", () => {
    const line = deriveLearningHeadline([h("number", "inconclusive")]);
    expect(line).toContain("결론이 난 방식이 없어요");
  });
});
