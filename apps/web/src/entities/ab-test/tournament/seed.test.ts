import { describe, it, expect } from "vitest";
import { build, SPECS } from "./seed";
import { deriveBeat } from "./engine";

// ADR-061 — 수렴 종결 데모 시드(browse_demo_tourn_converged) 회귀 안전망.
// build 가 챔피언 N=2 연속 방어를 completed+converged 로 굳히고, done 카드 재료(남은 예산)가 남는지 검증.
describe("수렴 종결 시드 (ADR-061)", () => {
  const spec = SPECS.find((s) => s.id === "browse_demo_tourn_converged");

  it("시드가 SPECS 에 등록돼 둘러보기 목록에 노출된다", () => {
    expect(spec).toBeDefined();
  });

  it("챔피언 2연속 방어로 completed + converged 로 종결한다", () => {
    const t = build(spec!);
    expect(t.status).toBe("completed");
    expect(t.completionReason).toBe("converged");
    // rawWinner 시퀀스 = B, A, A (R1 승격 → R2·R3 방어)
    expect(t.rounds.map((r) => r.rawWinner)).toEqual(["B", "A", "A"]);
    expect(deriveBeat(t)).toBe("done");
  });

  it("봉투 소진 전 수렴이라 남은 예산이 양수다 (done 카드 '남은 예산' 표기 유효)", () => {
    const t = build(spec!);
    const ceiling = t.envelope?.totalBudget ?? 0;
    expect(ceiling - t.spentBudget).toBeGreaterThan(0);
  });

  it("ample 시드는 winner-handling 보존 — 수렴 종결 아님(stopOnDefendStreak:99)", () => {
    const ample = SPECS.find((s) => s.id === "browse_demo_tourn_ample")!;
    expect(ample.envelope?.stopOnDefendStreak).toBe(99);
    expect(ample.finalStatus).toBe("running");
  });
});
