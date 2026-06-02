import { describe, it, expect } from "vitest";
import {
  roundAdKpis,
  settleRound,
  buildChallenger,
  nextAxis,
  isEnvelopeExhausted,
  type Tournament,
  type TourRound,
  type TourVariant,
} from "./tournament";

const A: TourVariant = { headline: "헤드라인 A", primaryText: "카피 A 본문입니다." };
const B: TourVariant = { headline: "헤드라인 B", primaryText: "카피 B 본문입니다." };

function round(extra?: Partial<TourRound>): TourRound {
  return {
    index: 1,
    axis: "headline",
    campaignId: "browse_tourn_t1_r1",
    champion: A,
    challenger: B,
    fastForwardDays: 0,
    status: "running",
    ...extra,
  };
}

describe("roundAdKpis", () => {
  it("빨리감기 전(0일차)은 두 광고 모두 빈 성과 — settleRound insufficient 진입", () => {
    const [a, b] = roundAdKpis(round({ fastForwardDays: 0 }), 1.8, 50000);
    expect(a.impressions).toBe(0);
    expect(b.impressions).toBe(0);
    expect(a.clicks).toBe(0);
    expect(a.ctr).toBe(0);
  });

  it("빨리감기 1주면 광고당 노출이 판정 임계(1000)를 넘고, 챔피언 CTR 부근이다", () => {
    const [a, b] = roundAdKpis(round({ fastForwardDays: 7 }), 2.0, 50000);
    expect(a.impressions).toBeGreaterThanOrEqual(1000);
    expect(b.impressions).toBeGreaterThanOrEqual(1000);
    expect(a.clicks).toBeGreaterThan(0);
    // A 는 챔피언 CTR(2.0%) 부근.
    expect(a.ctr).toBeGreaterThan(1.5);
    expect(a.ctr).toBeLessThan(2.5);
  });

  it("같은 라운드·같은 챔피언 CTR 이면 항상 같은 성과 (결정적)", () => {
    expect(roundAdKpis(round({ fastForwardDays: 7 }), 2.0, 50000)).toEqual(roundAdKpis(round({ fastForwardDays: 7 }), 2.0, 50000));
  });
});

// ADR-037 — 승격 = Meta 유의성(데모: z-검정 confidence). inconclusive 면 챔피언 방어(수렴 복원).
describe("settleRound — Meta 유의성 판정 (ADR-037)", () => {
  it("빨리감기 전이면 insufficient (미종료) · rawWinner=A 방어", () => {
    const res = settleRound(round({ fastForwardDays: 0 }), 1.8, 50000);
    expect(res.verdict.state).toBe("insufficient");
    expect(res.rawWinner).toBe("A");
  });

  it("최소 게재 기간(4일) 미달이면 노출이 쌓여도 insufficient — 실 Meta 는 스케줄 종료 전 winner 미확정 (ADR-037 §6)", () => {
    const res = settleRound(round({ fastForwardDays: 3 }), 2.0, 50000);
    expect(res.verdict.state).toBe("insufficient");
    expect(res.rawWinner).toBe("A");
  });

  it("챌린저 승격(rawWinner=B)은 유의(confidence ≥ 0.9)하고 챌린저 우세일 때만", () => {
    for (let i = 1; i <= 30; i++) {
      const res = settleRound(round({ index: i, campaignId: `browse_tourn_t1_r${i}`, fastForwardDays: 7 }), 2.0, 50000);
      expect(res.verdict.state).not.toBe("insufficient");
      if (res.rawWinner === "B") {
        expect(res.verdict.state).toBe("winner");
        expect(res.verdict.ctrB).toBeGreaterThan(res.verdict.ctrA);
        expect(res.verdict.confidence).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  it("유의미한 차이 없음(inconclusive)이면 챔피언 방어 — rawWinner=A", () => {
    const inconclusive = Array.from({ length: 60 }, (_, i) =>
      settleRound(round({ index: i, campaignId: `browse_tourn_t1_r${i}`, fastForwardDays: 7 }), 2.0, 50000),
    ).find((r) => r.verdict.state === "inconclusive");
    expect(inconclusive).toBeDefined();
    expect(inconclusive!.verdict.confidence).toBeLessThan(0.9);
    expect(inconclusive!.rawWinner).toBe("A");
  });
});

// ADR-037 V2 — awareness 목표는 CPM(노출 천 회당 비용) 으로 판정. championCtr=CPM 기준선(원).
describe("roundAdKpis · settleRound — awareness(CPM) 분기", () => {
  it("동일 예산에 노출 볼륨이 갈린다 — 챌린저 factor>1 이면 노출↑·CPM↓", () => {
    const [a, b] = roundAdKpis(round({ fastForwardDays: 7 }), 8000, 50000, 1.2, "awareness");
    expect(a.spend).toBe(b.spend); // 셀당 동일 예산
    expect(b.impressions).toBeGreaterThan(a.impressions); // 챌린저가 더 많은 노출(=낮은 CPM)
    const cpmA = (a.spend / a.impressions) * 1000;
    const cpmB = (b.spend / b.impressions) * 1000;
    expect(cpmB).toBeLessThan(cpmA);
  });

  it("CPM 우위 챌린저는 유의(노출 카운트 검정)하면 승격 — verdict 는 CPM 스케일", () => {
    const res = settleRound(round({ fastForwardDays: 7 }), 8000, 50000, 1.3, "awareness");
    expect(res.verdict.state).toBe("winner");
    expect(res.rawWinner).toBe("B");
    expect(res.verdict.ctrB).toBeLessThan(res.verdict.ctrA); // 낮은 CPM 이 우세
    expect(res.verdict.ctrA).toBeGreaterThan(1000); // % 가 아닌 CPM(원) 스케일
  });

  it("챔피언이 더 낮은 CPM(factor<1)이면 챔피언 방어 — rawWinner=A", () => {
    const res = settleRound(round({ fastForwardDays: 7 }), 8000, 50000, 0.75, "awareness");
    expect(res.rawWinner).toBe("A");
    expect(res.verdict.ctrB).toBeGreaterThan(res.verdict.ctrA); // 챌린저 CPM 이 더 높음(열위)
  });

  it("최소 게재 기간 미달이면 insufficient", () => {
    const res = settleRound(round({ fastForwardDays: 3 }), 8000, 50000, 1.3, "awareness");
    expect(res.verdict.state).toBe("insufficient");
    expect(res.rawWinner).toBe("A");
  });
});

// ADR-032 결정 3 — 좌표상승: 한 라운드는 한 축만 바꾼다(나머지 축은 챔피언 그대로).
describe("buildChallenger (축 직교 정제)", () => {
  const gen = {
    headlines: ["헤드라인 A", "새 헤드라인 X", "새 헤드라인 Y"],
    primaryTexts: ["카피 A 본문입니다.", "새 카피 X 본문.", "새 카피 Y 본문."],
  };

  it("헤드라인 축이면 카피는 챔피언과 동일·헤드라인만 바뀐다", () => {
    const c = buildChallenger(A, "headline", gen);
    expect(c.primaryText).toBe(A.primaryText);
    expect(c.headline).not.toBe(A.headline);
  });

  it("바꾸지 않는 축(이미지)은 챔피언 그대로 보존한다 — 축 오판정 방지", () => {
    const withImg: TourVariant = { ...A, imageUrl: "/x.jpg" };
    expect(buildChallenger(withImg, "headline", gen).imageUrl).toBe("/x.jpg");
    expect(buildChallenger(withImg, "primary_text", gen).imageUrl).toBe("/x.jpg");
  });

  it("카피 축이면 헤드라인은 챔피언과 동일·카피만 바뀐다", () => {
    const c = buildChallenger(A, "primary_text", gen);
    expect(c.headline).toBe(A.headline);
    expect(c.primaryText).not.toBe(A.primaryText);
  });
});

describe("nextAxis (좌표상승 순회)", () => {
  it("헤드라인 → 카피 → 헤드라인 으로 순회한다", () => {
    expect(nextAxis(0)).toBe("headline");
    expect(nextAxis(1)).toBe("primary_text");
    expect(nextAxis(2)).toBe("headline");
    expect(nextAxis(3)).toBe("primary_text");
  });
});

// ADR-054 — 정지는 자원 봉투(자동 예산·목표일) 소진, 통계 수렴 아님.
function settledRound(ff: number): TourRound {
  return { ...round({ fastForwardDays: ff }), status: "settled" };
}
function tour(extra: Partial<Tournament>): Tournament {
  return {
    id: "t1",
    brandProfileId: "bp1",
    productId: "p1",
    productName: "데모 제품",
    tone: "warm",
    objective: "traffic",
    mode: "auto",
    dailyBudget: 50000,
    champion: A,
    championCtr: 1.8,
    axisCursor: 0,
    rounds: [],
    spentBudget: 0,
    status: "running",
    createdAt: "2026-05-01T00:00:00.000Z",
    ...extra,
  };
}

describe("isEnvelopeExhausted (자원 봉투 정지)", () => {
  it("자동 예산: 누적 소진이 총예산 이상이면 소진", () => {
    const base = { mode: "auto" as const, envelope: { totalBudget: 300000 } };
    expect(isEnvelopeExhausted(tour({ ...base, spentBudget: 200000 }))).toBe(false);
    expect(isEnvelopeExhausted(tour({ ...base, spentBudget: 300000 }))).toBe(true);
  });

  it("자동 목표일: 누적 시뮬 일수가 목표일까지 일수에 도달하면 소진", () => {
    const near = tour({ mode: "auto", envelope: { targetDate: "2026-05-08" }, rounds: [settledRound(7)] });
    const far = tour({ mode: "auto", envelope: { targetDate: "2026-06-30" }, rounds: [settledRound(7)] });
    expect(isEnvelopeExhausted(near)).toBe(true);
    expect(isEnvelopeExhausted(far)).toBe(false);
  });
});
