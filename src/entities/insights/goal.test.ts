import { describe, it, expect } from "vitest";
import {
  deriveGuardrails,
  deriveGoalProgress,
  deriveLeadChain,
  pickMostAtRisk,
  type AccountGoal,
  type Goal,
} from "./goal";

describe("deriveGuardrails — ROAS 목표", () => {
  const goal: AccountGoal = { metric: "roas", target: 4 };

  it("완전 입력 → cpc-max/ctr-min 정확값", () => {
    const rails = deriveGuardrails(goal, { aov: 50_000, cvr: 0.05, cpm: 6_000 });
    expect(rails).toEqual([
      { kind: "cpc-max", value: 625 },
      { kind: "ctr-min", value: 0.96 },
    ]);
  });

  it("aov 없음 → cpc-max/ctr-min 모두 unavailable", () => {
    const rails = deriveGuardrails(goal, { cvr: 0.05, cpm: 6_000 });
    expect(rails[0]).toEqual({ kind: "unavailable", metric: "cpc-max", reason: "객단가 실측이 아직 없어요" });
    expect(rails[1].kind).toBe("unavailable");
  });

  it("cvr 없음 → cpc-max/ctr-min 모두 unavailable", () => {
    const rails = deriveGuardrails(goal, { aov: 50_000, cpm: 6_000 });
    expect(rails[0]).toEqual({ kind: "unavailable", metric: "cpc-max", reason: "전환율 실측이 아직 없어요" });
    expect(rails[1].kind).toBe("unavailable");
  });

  it("cpm 없음 → cpc-max 는 계산되고 ctr-min 만 unavailable", () => {
    const rails = deriveGuardrails(goal, { aov: 50_000, cvr: 0.05 });
    expect(rails[0]).toEqual({ kind: "cpc-max", value: 625 });
    expect(rails[1]).toEqual({ kind: "unavailable", metric: "ctr-min", reason: "CPM 실측이 아직 없어요" });
  });
});

describe("deriveGuardrails — contribution 목표", () => {
  const goal: AccountGoal = { metric: "contribution", target: 0 };

  it("marginRate=0.25 → bepRoas=4.0 으로 치환해 ROAS 경로와 동일값", () => {
    const rails = deriveGuardrails(goal, { aov: 50_000, cvr: 0.05, cpm: 6_000, marginRate: 0.25 });
    expect(rails).toEqual([
      { kind: "cpc-max", value: 625 },
      { kind: "ctr-min", value: 0.96 },
    ]);
  });

  it("marginRate 없음 → 전부 unavailable", () => {
    const rails = deriveGuardrails(goal, { aov: 50_000, cvr: 0.05, cpm: 6_000 });
    expect(rails).toEqual([
      { kind: "unavailable", metric: "cpc-max", reason: "마진율이 아직 설정되지 않았어요" },
      { kind: "unavailable", metric: "ctr-min", reason: "마진율이 아직 설정되지 않았어요" },
    ]);
  });
});

describe("deriveGuardrails — CPA 목표", () => {
  const goal: AccountGoal = { metric: "cpa", target: 15_000 };

  it("완전 입력 → cpc-max/ctr-min 정확값", () => {
    const rails = deriveGuardrails(goal, { cvr: 0.05, cpm: 6_000 });
    expect(rails).toEqual([
      { kind: "cpc-max", value: 750 },
      { kind: "ctr-min", value: 0.8 },
    ]);
  });

  it("cvr 없음 → 모두 unavailable", () => {
    const rails = deriveGuardrails(goal, { cpm: 6_000 });
    expect(rails[0]).toEqual({ kind: "unavailable", metric: "cpc-max", reason: "전환율 실측이 아직 없어요" });
    expect(rails[1].kind).toBe("unavailable");
  });

  it("cpm 없음 → cpc-max 만 계산됨", () => {
    const rails = deriveGuardrails(goal, { cvr: 0.05 });
    expect(rails[0]).toEqual({ kind: "cpc-max", value: 750 });
    expect(rails[1]).toEqual({ kind: "unavailable", metric: "ctr-min", reason: "CPM 실측이 아직 없어요" });
  });
});

describe("deriveGoalProgress — roas", () => {
  const goal: AccountGoal = { metric: "roas", target: 4 };

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
  const goal: AccountGoal = { metric: "contribution", target: 0 };

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
  const goal: AccountGoal = { metric: "cpa", target: 15_000 };

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

describe("deriveLeadChain", () => {
  const goal: AccountGoal = { metric: "roas", target: 4 };

  it("정상 역산 → cpc-max/ctr-min 모두 derived 매핑", () => {
    const leads = deriveLeadChain(goal, { aov: 50_000, cvr: 0.05, cpm: 6_000 });
    expect(leads).toEqual([
      { kind: "cpc-max", value: 625, source: "derived" },
      { kind: "ctr-min", value: 0.96, source: "derived" },
    ]);
  });

  it("입력 부족 → value null + reason 유지", () => {
    const leads = deriveLeadChain(goal, { cvr: 0.05, cpm: 6_000 });
    expect(leads).toEqual([
      { kind: "cpc-max", value: null, source: "derived", reason: "객단가 실측이 아직 없어요" },
      { kind: "ctr-min", value: null, source: "derived", reason: "객단가 실측이 아직 없어요" },
    ]);
  });
});

describe("pickMostAtRisk", () => {
  const onTrack: Goal = {
    id: "g1",
    name: "온트랙",
    lag: { metric: "roas", target: 1 },
    leads: [],
    createdAt: "2026-01-01",
  };
  const offTrack: Goal = {
    id: "g2",
    name: "오프트랙",
    lag: { metric: "roas", target: 8 },
    leads: [],
    createdAt: "2026-01-02",
  };
  const noData: Goal = {
    id: "g3",
    name: "노데이터",
    lag: { metric: "cpa", target: 15_000 },
    leads: [],
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
