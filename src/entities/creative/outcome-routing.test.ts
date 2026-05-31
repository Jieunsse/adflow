import { describe, expect, it } from "vitest";
import { selectOutcome, objectiveOf, ctaDefaultOf, isBoost, goalDefOf } from "./outcome-routing";
import { OBJECTIVES_ALL } from "./options";

// 회귀 안전망 — PRD §13.10 single-select 모델.
// (a) 같은 chip 재선택 → 해제
// (b) 다른 chip 선택 → 교체 + objective/cta 재도출
// (c) null 명시 → 해제, cta 유지

describe("selectOutcome", () => {
  it("새 chip 선택 → objective + cta 자동 도출 (Phase 1 traffic)", () => {
    const result = selectOutcome(null, "traffic", "sample");
    expect(result.outcome).toBe("traffic");
    expect(result.objective).toBe("OUTCOME_TRAFFIC");
    expect(result.cta).toBe("learn");
  });

  it("같은 chip 재선택 → 해제, objective null, cta 보존", () => {
    const result = selectOutcome("traffic", "traffic", "learn");
    expect(result.outcome).toBeNull();
    expect(result.objective).toBeNull();
    expect(result.cta).toBe("learn");
  });

  it("null 명시 → 해제, cta 보존", () => {
    const result = selectOutcome("engagement", null, "buy");
    expect(result.outcome).toBeNull();
    expect(result.objective).toBeNull();
    expect(result.cta).toBe("buy");
  });

  it("다른 chip 으로 교체 → objective/cta 재도출 (Phase 1 → Phase 2)", () => {
    const result = selectOutcome("traffic", "leads", "learn");
    expect(result.outcome).toBe("leads");
    expect(result.objective).toBe("OUTCOME_LEADS");
    expect(result.cta).toBe("buy");
  });

  // PRD §13 — 신규 4 goal 의 cta·objective 라우팅 회귀.
  it("traffic_page_visit → OUTCOME_TRAFFIC, cta 'learn'", () => {
    const result = selectOutcome(null, "traffic_page_visit", "buy");
    expect(result.outcome).toBe("traffic_page_visit");
    expect(result.objective).toBe("OUTCOME_TRAFFIC");
    expect(result.cta).toBe("learn");
  });

  it("engagement_page_likes → OUTCOME_ENGAGEMENT, cta 'like_page'", () => {
    const result = selectOutcome(null, "engagement_page_likes", "learn");
    expect(result.outcome).toBe("engagement_page_likes");
    expect(result.objective).toBe("OUTCOME_ENGAGEMENT");
    expect(result.cta).toBe("like_page");
  });

  it("engagement_messages → OUTCOME_ENGAGEMENT, cta 'message'", () => {
    const result = selectOutcome(null, "engagement_messages", "learn");
    expect(result.outcome).toBe("engagement_messages");
    expect(result.objective).toBe("OUTCOME_ENGAGEMENT");
    expect(result.cta).toBe("message");
  });

  it("leads_call → OUTCOME_LEADS, cta 'call' (Phase 1 LEADS 변종)", () => {
    const result = selectOutcome(null, "leads_call", "learn");
    expect(result.outcome).toBe("leads_call");
    expect(result.objective).toBe("OUTCOME_LEADS");
    expect(result.cta).toBe("call");
  });

  it("같은 Meta objective 의 두 chip 사이 교체 — cta 정확히 갈림", () => {
    // engagement_messages → engagement_page_likes 교체 시 cta 가 message → like_page 로 바뀌어야 함.
    const result = selectOutcome("engagement_messages", "engagement_page_likes", "message");
    expect(result.outcome).toBe("engagement_page_likes");
    expect(result.objective).toBe("OUTCOME_ENGAGEMENT");
    expect(result.cta).toBe("like_page");
  });
});

// 단일 source 가드 — 구 평면 Record(OUTCOME_TO_*)가 무가드 중복이던 자리.
// selector 는 OBJECTIVES_ALL 만 읽으므로 모든 chip 이 자기 엔트리 값으로 해소돼야 한다.
describe("outcome selectors (단일 source = OBJECTIVES_ALL)", () => {
  it("모든 chip 의 objectiveOf/ctaDefaultOf/goalDefOf 가 엔트리와 일치", () => {
    for (const g of OBJECTIVES_ALL) {
      expect(objectiveOf(g.id)).toBe(g.metaObjective);
      expect(ctaDefaultOf(g.id)).toBe(g.defaultCta);
      expect(goalDefOf(g.id)).toBe(g);
    }
  });

  it("null outcome → null 도출", () => {
    expect(objectiveOf(null)).toBeNull();
    expect(goalDefOf(null)).toBeNull();
    expect(isBoost(null)).toBe(false);
  });

  it("isBoost 는 boost_post 에만 true", () => {
    expect(isBoost("boost_post")).toBe(true);
    expect(isBoost("traffic")).toBe(false);
  });
});
