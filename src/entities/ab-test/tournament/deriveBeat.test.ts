import { describe, it, expect } from "vitest";
import {
  deriveBeat,
  detectAnomaly,
  isDecisionBeat,
  isRunningBeat,
  type Tournament,
  type TourRound,
  type TourVariant,
} from "./tournament";

const A: TourVariant = { headline: "헤드라인 A", primaryText: "카피 A" };
const B: TourVariant = { headline: "헤드라인 B", primaryText: "카피 B" };

function settled(index: number, winner: "A" | "B", challenger: TourVariant = B): TourRound {
  return {
    index,
    axis: "headline",
    campaignId: `t_r${index}`,
    champion: A,
    challenger,
    fastForwardDays: 7,
    verdict: { state: "winner", ctrA: 2, ctrB: winner === "B" ? 2.5 : 1.8, confidence: 0.95 },
    rawWinner: winner,
    adKpis: [
      { ctr: 2, impressions: 1000, clicks: 20, spend: 1000 },
      { ctr: winner === "B" ? 2.5 : 1.8, impressions: 1000, clicks: 22, spend: 1000 },
    ],
    status: "settled",
  };
}

function tour(extra: Partial<Tournament>): Tournament {
  return {
    id: "t1",
    brandProfileId: "browse_demo",
    productId: "p1",
    productName: "데모",
    tone: "warm",
    objective: "traffic",
    mode: "auto",
    dailyBudget: 50000,
    champion: A,
    championCtr: 2,
    championConfirmed: true,
    axisCursor: 0,
    rounds: [],
    spentBudget: 0,
    status: "running",
    createdAt: "2026-05-01T00:00:00.000Z",
    ...extra,
  };
}

describe("ADR-035 deriveBeat — auto 무인 / 필요 브레이크", () => {
  it("출발 챔피언 미확정 = champion-review (셋업 게이트)", () => {
    expect(deriveBeat(tour({ championConfirmed: false }))).toBe("champion-review");
  });

  it("auto · 봉투 미소진 · 정상 = auto-running (무인)", () => {
    const t = tour({ envelope: { totalBudget: 1_000_000 }, rounds: [settled(1, "B")], spentBudget: 350000 });
    expect(deriveBeat(t)).toBe("auto-running");
  });

  it("auto · 봉투 소진 = winner-handling (ⓐ)", () => {
    const t = tour({ envelope: { totalBudget: 300000 }, spentBudget: 300000, rounds: [settled(1, "B")] });
    expect(deriveBeat(t)).toBe("winner-handling");
  });

  it("auto · 연속 3R 챌린저 미승격 = anomaly (ⓑ 정체, ADR-037)", () => {
    const two = tour({ envelope: { totalBudget: 1_000_000 }, rounds: [settled(1, "A"), settled(2, "A")] });
    expect(detectAnomaly(two)).toBeNull(); // 2R 만으로는 미발동 (inconclusive 정상)
    const three = tour({ envelope: { totalBudget: 1_000_000 }, rounds: [settled(1, "A"), settled(2, "A"), settled(3, "A")] });
    expect(detectAnomaly(three)?.kind).toBe("stagnation");
    expect(deriveBeat(three)).toBe("anomaly");
  });

  it("auto · 금칙어 위반 챌린저 = anomaly (ⓑ 금칙어)", () => {
    const bad: TourVariant = { headline: "역대급 1위 할인", primaryText: "지금 사세요" };
    const t = tour({
      envelope: { totalBudget: 1_000_000 },
      prohibitedWords: ["역대급", "1위"],
      rounds: [settled(1, "B", bad)],
    });
    expect(detectAnomaly(t)?.kind).toBe("prohibited");
    expect(deriveBeat(t)).toBe("anomaly");
  });

  it("이상 신호를 사람이 '계속'(anomalyClearedRound)하면 auto-running 으로 재개", () => {
    const t = tour({
      envelope: { totalBudget: 1_000_000 },
      rounds: [settled(1, "A"), settled(2, "A"), settled(3, "A")],
      anomalyClearedRound: 3,
    });
    expect(deriveBeat(t)).toBe("auto-running");
  });

  it("완료 = done, 우선순위는 winner > anomaly", () => {
    expect(deriveBeat(tour({ status: "completed" }))).toBe("done");
    const both = tour({
      envelope: { totalBudget: 300000 },
      spentBudget: 300000,
      rounds: [settled(1, "A"), settled(2, "A"), settled(3, "A")],
    });
    expect(deriveBeat(both)).toBe("winner-handling");
  });

  it("manual-n = 매 단계 제어 (live / challenger-review / between)", () => {
    const live = tour({ mode: "manual-n", rounds: [{ ...settled(1, "B"), status: "running" }] });
    expect(deriveBeat(live)).toBe("live");
    const review = tour({ mode: "manual-n", pendingChallenger: B });
    expect(deriveBeat(review)).toBe("challenger-review");
    const between = tour({ mode: "manual-n", rounds: [settled(1, "B")] });
    expect(deriveBeat(between)).toBe("between");
  });

  it("isDecisionBeat / isRunningBeat 분류", () => {
    expect(isDecisionBeat("winner-handling")).toBe(true);
    expect(isDecisionBeat("anomaly")).toBe(true);
    expect(isDecisionBeat("auto-running")).toBe(false);
    expect(isRunningBeat("auto-running")).toBe(true);
    expect(isRunningBeat("live")).toBe(true);
    expect(isRunningBeat("winner-handling")).toBe(false);
  });
});
