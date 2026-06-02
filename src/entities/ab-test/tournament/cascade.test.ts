import { describe, it, expect } from "vitest";
import { applyAutoAdvance, applySettle, type CreativeGen } from "./transitions";
import { deriveBeat, isDecisionBeat, type Tournament, type Hypothesis } from "./engine";

// 데모 캐스케이드의 순수 엔진 루프를 재현 — auto-advance(가설 생성) → settle(판정·resolve) 반복.
// 클라(client.demoCascade)는 이 동일 transitions 를 서버 라우트로 위임할 뿐 로직은 같다.
const GEN: CreativeGen = {
  headlines: ["헤드라인 후보 1", "헤드라인 후보 2", "헤드라인 후보 3"],
  primaryTexts: ["카피 후보 1", "카피 후보 2", "카피 후보 3"],
};

function cascade(t: Tournament): Hypothesis[] {
  const resolved: Hypothesis[] = [];
  for (let i = 0; i < 16; i++) {
    const beat = deriveBeat(t);
    if (beat === "done") break;
    // 진짜 브레이크만 정지 — manual-n 의 between·challenger-review 는 발표자 캐스케이드가 자동 통과(client.demoCascade 와 동일).
    if (beat === "winner-handling" || beat === "anomaly" || beat === "champion-review") break;
    const running = t.rounds.find((r) => r.status === "running");
    if (running) {
      const { result } = applySettle(t, running.fastForwardDays + 7);
      if (result.status === "settled" && result.round.hypothesis) resolved.push(result.round.hypothesis);
    } else {
      applyAutoAdvance(t, GEN, resolved); // Ledger = 지금까지 resolved (client 의 localStorage 동기화 대응)
    }
  }
  return resolved;
}

function ampleTournament(): Tournament {
  return {
    id: "browse_demo_tourn_ample",
    brandProfileId: "browse_demo",
    productId: "browse_demo_tourn_ample",
    productName: "비타민 비건 앰플",
    tone: "pro",
    objective: "traffic",
    mode: "auto",
    maxRounds: 6,
    dailyBudget: 50000,
    champion: { headline: "칙칙한 피부에 비타민 한 방울", primaryText: "식물성 비타민 앰플." },
    championCtr: 1.7,
    championConfirmed: true,
    envelope: { totalBudget: 1500000 },
    axisCursor: 0,
    rounds: [],
    spentBudget: 0,
    status: "running",
    createdAt: "2026-05-30T10:00:00+09:00",
  };
}

// manual-n — 사람이 매 라운드 결정하는 모드. 발표자 빨리감기는 between·challenger-review 를 자동 통과해야 한다.
function manualTournament(): Tournament {
  return {
    ...ampleTournament(),
    mode: "manual-n",
    maxRounds: 4,
    envelope: undefined,
  };
}

describe("manual-n 발표자 캐스케이드 (둘러보기 빨리감기)", () => {
  it("between·challenger-review 결정 지점을 자동 통과해 maxRounds 까지 돌고 done 에서 멈춘다", () => {
    const t = manualTournament();
    cascade(t);
    expect(deriveBeat(t)).toBe("done");
    expect(t.status).toBe("completed");
    expect(t.rounds.filter((r) => r.status === "settled").length).toBe(4);
  });

  it("모든 결산 라운드에 resolved 가설이 붙는다(자동 제안→게재가 가설을 세운다)", () => {
    const t = manualTournament();
    const resolved = cascade(t);
    expect(resolved.length).toBe(4);
    for (const h of resolved) expect(h.status).toBe("resolved");
  });
});

describe("가설 캐스케이드 (ADR-044)", () => {
  it("여러 라운드를 돌고 ADR-035 브레이크(봉투 소진 또는 정체 이상신호)에서 멈춘다", () => {
    const t = ampleTournament();
    cascade(t);
    const beat = deriveBeat(t);
    expect(isDecisionBeat(beat)).toBe(true);
    expect(["winner-handling", "anomaly"]).toContain(beat);
    expect(t.rounds.filter((r) => r.status === "settled").length).toBeGreaterThanOrEqual(3);
  });

  it("모든 결산 라운드에 resolved 가설(근거 포함)이 붙는다", () => {
    const t = ampleTournament();
    const resolved = cascade(t);
    expect(resolved.length).toBeGreaterThanOrEqual(4);
    for (const h of resolved) {
      expect(h.status).toBe("resolved");
      expect(h.verdict).toBeDefined();
      expect(h.rationale.length).toBeGreaterThan(0);
      expect(h.rationaleSource).toBeDefined();
    }
  });

  it("음성 학습 — 입증과 반증/미결이 모두 나온다 (PRD §2.1.6)", () => {
    const t = ampleTournament();
    const resolved = cascade(t);
    const verdicts = resolved.map((h) => h.verdict);
    expect(verdicts).toContain("confirmed");
    expect(verdicts.some((v) => v === "refuted" || v === "inconclusive")).toBe(true);
  });

  it("반증된 레버는 이후 라운드에서 다시 선택되지 않는다 (음성 가지치기)", () => {
    const t = ampleTournament();
    const resolved = cascade(t);
    const refuted = resolved.filter((h) => h.verdict === "refuted").map((h) => h.lever);
    // 반증된 레버가 두 번 이상 등장하지 않는다 (가지치기 → 재선택 회피)
    for (const lever of refuted) {
      expect(resolved.filter((h) => h.lever === lever).length).toBe(1);
    }
  });
});
