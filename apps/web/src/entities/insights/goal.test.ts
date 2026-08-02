import { describe, expect, it } from "vitest";
import { deriveGoalProgress, pickMostAtRisk, type Goal } from "./goal";

describe("deriveGoalProgress — roas", () => {
  const goal = { metric: "roas" as const, target: 4 };

  it("정확히 target → on-track", () => {
    expect(deriveGoalProgress(goal, { roas: 4 })).toEqual({ status: "on-track", currentValue: 4, target: 4, metric: "roas" });
  });

  it("0.8 경계(target×0.8) → at-risk", () => {
    expect(deriveGoalProgress(goal, { roas: 3.2 }).status).toBe("at-risk");
  });

  it("0.8 경계 미만 → off-track", () => {
    expect(deriveGoalProgress(goal, { roas: 3.19 }).status).toBe("off-track");
  });

  it("current null → no-data", () => {
    expect(deriveGoalProgress(goal, { roas: null })).toEqual({ status: "no-data", currentValue: null, target: 4, metric: "roas" });
  });
});

describe("deriveGoalProgress — contribution", () => {
  const goal = { metric: "contribution" as const, target: 0 };

  it("marginRate=0.25 → target=bepRoas=4.0, current.roas 로 판정", () => {
    expect(deriveGoalProgress(goal, { roas: 4 }, 0.25)).toEqual({
      status: "on-track",
      currentValue: 4,
      target: 4,
      metric: "contribution",
    });
  });

  it("marginRate null/undefined → no-data", () => {
    expect(deriveGoalProgress(goal, { roas: 4 }, null).status).toBe("no-data");
    expect(deriveGoalProgress(goal, { roas: 4 }).status).toBe("no-data");
  });
});

describe("deriveGoalProgress — cpa", () => {
  const goal = { metric: "cpa" as const, target: 15_000 };

  it("정확히 target → on-track", () => {
    expect(deriveGoalProgress(goal, { cpa: 15_000 })).toEqual({ status: "on-track", currentValue: 15_000, target: 15_000, metric: "cpa" });
  });

  it("1.2 경계(target×1.2) → at-risk", () => {
    expect(deriveGoalProgress(goal, { cpa: 18_000 }).status).toBe("at-risk");
  });

  it("1.2 경계 초과 → off-track", () => {
    expect(deriveGoalProgress(goal, { cpa: 18_001 }).status).toBe("off-track");
  });

  it("current null → no-data", () => {
    expect(deriveGoalProgress(goal, { cpa: null })).toEqual({ status: "no-data", currentValue: null, target: 15_000, metric: "cpa" });
  });
});

describe("pickMostAtRisk", () => {
  const onTrack: Goal = {
    id: "g1",
    name: "온트랙",
    lag: { metric: "roas", target: 1 },
    createdAt: "2026-01-01",
  };
  const offTrack: Goal = {
    id: "g2",
    name: "오프트랙",
    lag: { metric: "roas", target: 8 },
    createdAt: "2026-01-02",
  };
  const noData: Goal = {
    id: "g3",
    name: "노데이터",
    lag: { metric: "cpa", target: 15_000 },
    createdAt: "2026-01-03",
  };

  it("off-track가 on-track 를 이김", () => {
    const result = pickMostAtRisk([onTrack, offTrack], { roas: 4 });
    expect(result?.goal.id).toBe("g2");
    expect(result?.progress.status).toBe("off-track");
  });

  it("동순위면 배열 앞쪽(먼저 만든 목표) 우선", () => {
    const offTrack2: Goal = { ...offTrack, id: "g2b", createdAt: "2026-01-03" };
    const result = pickMostAtRisk([offTrack, offTrack2], { roas: 0 });
    expect(result?.goal.id).toBe("g2");
  });

  it("빈 배열 → null", () => {
    expect(pickMostAtRisk([], { roas: 4 })).toBeNull();
  });

  it("no-data가 on-track에 밀림", () => {
    const result = pickMostAtRisk([noData, onTrack], { roas: 4, cpa: null });
    expect(result?.goal.id).toBe(onTrack.id);
    expect(result?.progress.status).toBe("on-track");
  });
});
