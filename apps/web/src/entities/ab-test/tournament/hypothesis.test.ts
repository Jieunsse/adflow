import { describe, it, expect } from "vitest";
import {
  selectNextLever,
  summarizeLedger,
  filterByContext,
  buildHypothesis,
  resolveHypothesis,
  deriveLedger,
  leverPool,
  type LedgerContext,
} from "./hypothesis";
import type { Hypothesis, RoundVerdict, Tournament, TourRound } from "./engine";

const CTX: LedgerContext = { productId: "p1", objective: "traffic" };

function resolved(lever: Hypothesis["lever"], verdict: Hypothesis["verdict"], ctx: Partial<LedgerContext> = {}): Hypothesis {
  return {
    id: `h_${lever}`,
    lever,
    statement: "s",
    predictedMetric: "CTR",
    predictedDirection: "up",
    rationale: "r",
    rationaleSource: "ledger",
    contextTags: { productId: ctx.productId ?? "p1", personaId: ctx.personaId, objective: ctx.objective ?? "traffic" },
    status: "resolved",
    verdict,
  };
}

describe("deriveLedger — tournaments 투영 (ADR-047)", () => {
  function tourn(id: string, rounds: Partial<TourRound>[]): Tournament {
    return {
      id, brandProfileId: "b1", productId: "p1", productName: "x", tone: "warm", objective: "traffic",
      mode: "auto", dailyBudget: 1, champion: { headline: "", primaryText: "" }, championCtr: 1,
      axisCursor: 0, spentBudget: 0, status: "completed", createdAt: "t",
      rounds: rounds.map((r, i) => ({ index: i + 1, axis: "headline", campaignId: "c", champion: { headline: "", primaryText: "" }, challenger: { headline: "", primaryText: "" }, fastForwardDays: 7, status: "settled", ...r })),
    };
  }

  it("여러 토너먼트의 resolved 가설만 평탄화한다 (testing·미게재 라운드 제외)", () => {
    const t1 = tourn("t1", [{ hypothesis: resolved("trust", "confirmed") }, { hypothesis: { ...resolved("rush", "refuted"), status: "testing" } }]);
    const t2 = tourn("t2", [{ hypothesis: resolved("number", "inconclusive") }, { hypothesis: undefined }]);
    const ledger = deriveLedger([t1, t2]);
    expect(ledger.map((h) => h.lever).sort()).toEqual(["number", "trust"]);
  });

  it("빈 입력·라운드 없음은 빈 배열", () => {
    expect(deriveLedger([])).toEqual([]);
    expect(deriveLedger([tourn("t", [])])).toEqual([]);
  });
});

describe("레버 taxonomy / 풀", () => {
  it("image-scene 은 자동 순회 풀에서 제외된다 (PRD §8 후속)", () => {
    expect(leverPool("traffic")).not.toContain("image-scene");
  });
  it("목표 추천 카피훅이 풀 앞에 온다 (traffic = number·trust·benefit)", () => {
    expect(leverPool("traffic").slice(0, 3)).toEqual(["number", "trust", "benefit"]);
  });
});

describe("Ledger 필터 — contextTags", () => {
  it("제품·목표가 다르면 거른다", () => {
    const entries = [resolved("rush", "confirmed"), resolved("trust", "confirmed", { productId: "p2" }), resolved("benefit", "confirmed", { objective: "awareness" })];
    const rel = filterByContext(entries, CTX);
    expect(rel.map((e) => e.lever)).toEqual(["rush"]);
  });
});

describe("summarizeLedger", () => {
  it("verdict 별로 confirmed/refuted/tested 버킷에 담는다", () => {
    const entries = [resolved("rush", "refuted"), resolved("trust", "confirmed"), resolved("benefit", "inconclusive")];
    const s = summarizeLedger(entries, CTX);
    expect(s.refuted.has("rush")).toBe(true);
    expect(s.confirmed.has("trust")).toBe(true);
    expect(s.tested.has("benefit")).toBe(true); // inconclusive 도 tested
    expect(s.confirmed.has("benefit")).toBe(false);
  });
});

describe("selectNextLever — ⓐ재탕회피 ⓑ미탐색우선 ⓒ음성가지치기", () => {
  it("ⓒ 반증된 레버는 다시 고르지 않는다", () => {
    // 모든 미탐색을 막고 number 만 반증 → number 절대 선택 안 됨
    const refutedAll = leverPool("traffic")
      .filter((l) => l !== "number")
      .map((l) => resolved(l, "inconclusive")); // 전부 tested(미결)
    const entries = [...refutedAll, resolved("number", "refuted")];
    for (let seed = 0; seed < 20; seed++) {
      expect(selectNextLever(entries, CTX, seed)).not.toBe("number");
    }
  });

  it("ⓑ 미탐색 레버를 tested 레버보다 우선한다", () => {
    const pool = leverPool("traffic");
    // 첫 두 개만 tested(미결) → 나머지(미탐색)에서만 골라야 한다
    const entries = [resolved(pool[0], "inconclusive"), resolved(pool[1], "inconclusive")];
    for (let seed = 0; seed < 20; seed++) {
      const picked = selectNextLever(entries, CTX, seed);
      expect([pool[0], pool[1]]).not.toContain(picked);
    }
  });

  it("결정적 — 같은 입력이면 같은 레버", () => {
    expect(selectNextLever([], CTX, 5)).toBe(selectNextLever([], CTX, 5));
  });

  it("빈 Ledger 면 추천 레버를 고른다 (seed 0 = number)", () => {
    expect(selectNextLever([], CTX, 0)).toBe("number");
  });
});

describe("buildHypothesis — 근거 강제", () => {
  it("rationale·rationaleSource·statement·contextTags 를 모두 채운다", () => {
    const h = buildHypothesis({ lever: "rush", ctx: CTX, rationaleSource: "platform-prior", idSeed: "r1" });
    expect(h.rationale.length).toBeGreaterThan(0);
    expect(h.rationaleSource).toBe("platform-prior");
    expect(h.statement).toContain("CTR"); // {metric} 치환
    expect(h.contextTags.objective).toBe("traffic");
    expect(h.status).toBe("proposed");
  });
});

describe("resolveHypothesis — verdict 매핑 (3종 모두 적재 가능)", () => {
  const mk = (state: RoundVerdict["state"], ctrA: number, ctrB: number, conf = 0.95): RoundVerdict => ({ state, ctrA, ctrB, confidence: conf });
  const base = buildHypothesis({ lever: "rush", ctx: CTX, rationaleSource: "ledger", idSeed: "r1" });

  it("챌린저 유의 승격 → confirmed", () => {
    expect(resolveHypothesis(base, mk("winner", 2, 2.6), "B", "t").verdict).toBe("confirmed");
  });
  it("챔피언 유의 방어 → refuted", () => {
    expect(resolveHypothesis(base, mk("winner", 2.6, 2), "A", "t").verdict).toBe("refuted");
  });
  it("불충분 → inconclusive", () => {
    expect(resolveHypothesis(base, mk("inconclusive", 2, 2.05), "A", "t").verdict).toBe("inconclusive");
  });
  it("effectSize = 챌린저 lift % (rate=높을수록 개선)", () => {
    const r = resolveHypothesis(base, mk("winner", 2, 2.4), "B", "t");
    expect(r.effectSize).toBe(20); // (2.4-2)/2 = +20%
    expect(r.status).toBe("resolved");
  });
});
