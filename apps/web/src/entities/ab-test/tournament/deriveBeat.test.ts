import { describe, it, expect } from "vitest";
import {
  deriveBeat,
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

describe("ADR-054 deriveBeat — 완전 무인 / 예산만 사람", () => {
  it("출발 챔피언 미확정 = champion-review (셋업 게이트)", () => {
    expect(deriveBeat(tour({ championConfirmed: false }))).toBe("champion-review");
  });

  it("봉투 미소진 · 정상 = auto-running (무인)", () => {
    const t = tour({ envelope: { totalBudget: 1_000_000 }, rounds: [settled(1, "B")], spentBudget: 350000 });
    expect(deriveBeat(t)).toBe("auto-running");
  });

  it("봉투 소진 = winner-handling (예산 — 유일한 사람 결정)", () => {
    const t = tour({ envelope: { totalBudget: 300000 }, spentBudget: 300000, rounds: [settled(1, "B")] });
    expect(deriveBeat(t)).toBe("winner-handling");
  });

  it("연속 3R 챌린저 미승격이라도 멈추지 않는다 (정체 자동 돌파)", () => {
    const three = tour({ envelope: { totalBudget: 1_000_000 }, rounds: [settled(1, "A"), settled(2, "A"), settled(3, "A")] });
    expect(deriveBeat(three)).toBe("auto-running");
  });

  it("금칙어가 든 챌린저라도 멈추지 않는다 (생성 단계 구조 차단)", () => {
    const bad: TourVariant = { headline: "역대급 1위 할인", primaryText: "지금 사세요" };
    const t = tour({ envelope: { totalBudget: 1_000_000 }, prohibitedWords: ["역대급", "1위"], rounds: [settled(1, "B", bad)] });
    expect(deriveBeat(t)).toBe("auto-running");
  });

  it("완료 = done, 봉투 소진이 진행보다 우선", () => {
    expect(deriveBeat(tour({ status: "completed" }))).toBe("done");
    const exhausted = tour({ envelope: { totalBudget: 300000 }, spentBudget: 300000, rounds: [settled(1, "A")] });
    expect(deriveBeat(exhausted)).toBe("winner-handling");
  });

  it("isDecisionBeat / isRunningBeat 분류 (ADR-054 — 예산·셋업 게이트만 결정)", () => {
    expect(isDecisionBeat("winner-handling")).toBe(true);
    expect(isDecisionBeat("champion-review")).toBe(true);
    expect(isDecisionBeat("auto-running")).toBe(false);
    expect(isRunningBeat("auto-running")).toBe(true);
    expect(isRunningBeat("winner-handling")).toBe(false);
  });
});
