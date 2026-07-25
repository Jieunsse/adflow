import { describe, expect, it } from "vitest";
import { deriveVerdict, DATA_GATHERING_TITLES, type Suggestion } from "./optimization";

// ADR-048 — deriveVerdict 는 우선순위 정렬된 suggestions[] 의 1순위를 평결로 승격한다.
// 새 계산 없음 — 1순위 kind/severity/title 만 읽어 상태를 분류. collecting(데이터부족)은 제목으로 선판정.

const pause: Suggestion = { kind: "pause", severity: "warn", title: "성과가 부진해요", detail: [] };
const fake: Suggestion = { kind: "fake-performance", severity: "warn", title: "겉보기 성과가 의심돼요", detail: [] };
const increase: Suggestion = { kind: "increase-budget", severity: "info", title: "성과가 좋아요", detail: [], fromDailyBudget: 50000, toDailyBudget: 65000 };
const stableNote: Suggestion = { kind: "note", severity: "info", title: "지금은 안정적이에요", detail: [] };
const warnNote: Suggestion = { kind: "note", severity: "warn", title: "클릭당 비용이 높아요", detail: [] };
const gatheringNote: Suggestion = { kind: "note", severity: "info", title: DATA_GATHERING_TITLES.dataGap, detail: [] };

describe("deriveVerdict", () => {
  it("1순위 fake-performance → trap (호조보다 우선)", () => {
    // page.tsx 가 fake 감지 시 증액 제안을 뒤로 밀고 점검을 1순위로 둔다 — 그 순서를 그대로 소비.
    expect(deriveVerdict([fake, stableNote])?.status).toBe("trap");
  });

  it("1순위 pause → poor", () => {
    expect(deriveVerdict([pause])?.status).toBe("poor");
  });

  it("1순위 warn note → poor (pause 아니어도 경고면 점검)", () => {
    expect(deriveVerdict([warnNote, stableNote])?.status).toBe("poor");
  });

  it("1순위 increase-budget → cruising", () => {
    expect(deriveVerdict([increase])?.status).toBe("cruising");
  });

  it("info note 만 → stable", () => {
    expect(deriveVerdict([stableNote])?.status).toBe("stable");
  });

  it("데이터 수집 note 가 1순위 → collecting (info note 지만 stable 과 구분)", () => {
    expect(deriveVerdict([gatheringNote])?.status).toBe("collecting");
  });

  it("headline = 1순위 title 그대로 (새 카피 0줄)", () => {
    expect(deriveVerdict([pause])?.headline).toBe("성과가 부진해요");
  });

  it("제안 없으면 null", () => {
    expect(deriveVerdict([])).toBeNull();
  });
});
