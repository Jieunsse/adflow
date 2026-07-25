import { describe, it, expect } from "vitest";
import { ledgerBiasedHooks } from "./ledger-bias";
import { ledgerLadder } from "./hypothesis";
import { recommendedHooks } from "@entities/creative/options";
import type { CopyHook } from "@entities/creative/options";
import type { Hypothesis } from "./engine";

// traffic 추천 = number·trust·benefit (options.ts HOOK_RECOMMENDATIONS_BY_OBJECTIVE)
const OUTCOME = "traffic";

function resolved(
  lever: CopyHook,
  verdict: Hypothesis["verdict"],
  effectSize: number,
  ctx: { productId?: string; objective?: string } = {},
): Hypothesis {
  return {
    id: `h_${lever}_${ctx.productId ?? "p1"}`,
    lever,
    statement: "s",
    predictedMetric: "CTR",
    predictedDirection: "up",
    rationale: "r",
    rationaleSource: "ledger",
    contextTags: { productId: ctx.productId ?? "p1", objective: ctx.objective ?? "traffic" },
    status: "resolved",
    verdict,
    effectSize,
  };
}

describe("ledgerBiasedHooks — Ledger 편향 코어 (ADR-050)", () => {
  it("빈 Ledger → recommendedHooks 그대로 (콜드스타트 폴백·회귀 가드)", () => {
    const { hooks, bias } = ledgerBiasedHooks(OUTCOME, { product: [], brand: [] });
    expect(hooks).toEqual(recommendedHooks(OUTCOME));
    expect(bias).toEqual({});
  });

  it("제품+목표 입증 → 해당 레버 풀 상단 승격 + 배지 메타", () => {
    // base = [number, trust, benefit]. trust 를 입증하면 최상단으로.
    const { hooks, bias } = ledgerBiasedHooks(OUTCOME, {
      product: [resolved("trust", "confirmed", 22)],
      brand: [],
    });
    expect(hooks[0]).toBe("trust");
    expect(bias.trust).toEqual({ verdict: "confirmed", effectSize: 22, tier: "product" });
    expect(hooks).toHaveLength(3);
  });

  it("base 밖 레버도 입증되면 상단 승격된다 (story 는 traffic 추천 아님)", () => {
    const { hooks } = ledgerBiasedHooks(OUTCOME, {
      product: [resolved("story", "confirmed", 30)],
      brand: [],
    });
    expect(hooks[0]).toBe("story");
  });

  it("제품+목표 반증 → 풀에서 제외 + backfill 로 본문 3개 유지", () => {
    // number 반증 → 추천 3종 중 number 빠지고 다음 카피훅으로 채워 3개.
    const { hooks, bias } = ledgerBiasedHooks(OUTCOME, {
      product: [resolved("number", "refuted", -18)],
      brand: [],
    });
    expect(hooks).not.toContain("number");
    expect(hooks).toHaveLength(3);
    expect(bias.number).toEqual({ verdict: "refuted", effectSize: -18, tier: "product" });
  });

  it("미결(inconclusive) → 중립 (미탐색과 동일, 순서 영향 없음·배지 없음)", () => {
    const { hooks, bias } = ledgerBiasedHooks(OUTCOME, {
      product: [resolved("trust", "inconclusive", 1)],
      brand: [],
    });
    expect(hooks).toEqual(recommendedHooks(OUTCOME));
    expect(bias.trust).toBeUndefined();
  });

  it("1단 비고 2단(브랜드 집계)만 → 순입증>0 만 승격, 음수·동률 중립", () => {
    // benefit: 타 제품 2입증 → 승격. surprise: 1입증 1반증(동률) → 중립.
    const { hooks, bias } = ledgerBiasedHooks(OUTCOME, {
      product: [],
      brand: [
        resolved("benefit", "confirmed", 12, { productId: "p2" }),
        resolved("benefit", "confirmed", 16, { productId: "p3" }),
        resolved("surprise", "confirmed", 10, { productId: "p2" }),
        resolved("surprise", "refuted", -8, { productId: "p3" }),
      ],
    });
    expect(hooks[0]).toBe("benefit");
    expect(bias.benefit).toEqual({ verdict: "confirmed", effectSize: 14, tier: "brand" });
    expect(bias.surprise).toBeUndefined(); // 동률 → 중립, 배지 없음
  });

  it("1단·2단 충돌 → 1단(제품 전용)이 override 한다", () => {
    // 제품에선 trust 반증, 브랜드 집계에선 trust 입증 → 제품 우선 = 반증(제외).
    const { hooks, bias } = ledgerBiasedHooks(OUTCOME, {
      product: [resolved("trust", "refuted", -15)],
      brand: [resolved("trust", "confirmed", 20, { productId: "p2" })],
    });
    expect(hooks).not.toContain("trust");
    expect(bias.trust).toEqual({ verdict: "refuted", effectSize: -15, tier: "product" });
  });
});

describe("ledgerLadder — 2단 분리 (ADR-050)", () => {
  const ctx = { productId: "p1", objective: "traffic" };
  const entries = [
    resolved("trust", "confirmed", 10), // p1/traffic → product
    resolved("benefit", "confirmed", 12, { productId: "p2" }), // 타제품/traffic → brand
    resolved("rush", "confirmed", 8, { objective: "awareness" }), // 다른 목표 → 둘 다 제외
  ];

  it("product = 제품+목표, brand = 같은 목표 타 제품", () => {
    const { product, brand } = ledgerLadder(entries, ctx);
    expect(product.map((h) => h.lever)).toEqual(["trust"]);
    expect(brand.map((h) => h.lever)).toEqual(["benefit"]);
  });
});
