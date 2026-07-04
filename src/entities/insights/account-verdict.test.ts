import { describe, expect, it } from "vitest";
import { deriveAccountVerdict, deriveHeroLayout, type AccountVerdictCampaign } from "./account-verdict";

// ADR-057 — deriveAccountVerdict 는 캠페인별 deriveVerdict 를 계정 횡단 우선순위로 머지한다.
// 우선순위: trap(함정) > poor(부진) > cruising(호조) > stable(안정). collecting 은 판정 보류(데이터 부족).
// 새 숫자 0 — 캠페인별 suggestOptimizations + fake-perf 를 재사용해 verdict 를 구한 뒤 가장 무서운 신호를 끌어올린다.

// 충분한 데이터(노출·클릭·기간)를 통과시키는 라이브 캠페인 베이스.
function camp(over: Partial<AccountVerdictCampaign>): AccountVerdictCampaign {
  return {
    id: "c1",
    headline: "캠페인",
    status: "live",
    objective: "OUTCOME_TRAFFIC",
    impressions: 20_000,
    clicks: 200,
    ctr: 1.5,
    spend: 100_000,
    dailyBudget: 50_000,
    adSetId: "as1",
    daysOfData: 7,
    ...over,
  };
}

describe("deriveAccountVerdict", () => {
  it("캠페인 0개 → collecting 게이트 status", () => {
    const v = deriveAccountVerdict([]);
    expect(v.status).toBe("collecting");
    expect(v.count).toBe(0);
  });

  it("라이브 캠페인 0개(전부 paused/ended) → collecting", () => {
    const v = deriveAccountVerdict([camp({ status: "paused" }), camp({ id: "c2", status: "ended" })]);
    expect(v.status).toBe("collecting");
    expect(v.count).toBe(0);
  });

  it("부진(낮은 CTR) 캠페인 → poor + 해당 캠페인 pause 액션", () => {
    const v = deriveAccountVerdict([camp({ ctr: 0.3 })]);
    expect(v.status).toBe("poor");
    expect(v.count).toBe(1);
    expect(v.primaryAction?.kind).toBe("pause");
    expect(v.primaryAction?.campaignId).toBe("c1");
  });

  it("호조(높은 CTR) 캠페인 → cruising + increase-budget 액션", () => {
    const v = deriveAccountVerdict([camp({ ctr: 3.0 })]);
    expect(v.status).toBe("cruising");
    expect(v.primaryAction?.kind).toBe("increase-budget");
  });

  it("우선순위 머지 — poor 가 cruising 보다 위로 올라온다", () => {
    const v = deriveAccountVerdict([camp({ id: "good", ctr: 3.0 }), camp({ id: "bad", ctr: 0.3 })]);
    expect(v.status).toBe("poor");
    expect(v.primaryAction?.campaignId).toBe("bad");
  });

  it("함정(fake-performance) 이 부진보다 위", () => {
    const trap = camp({
      id: "trap",
      ctr: 2.5,
      impressions: 20_000,
      linkClick: 1_000,
      landingPageView: 100, // 도착률 10% — 함정
    });
    const v = deriveAccountVerdict([camp({ id: "bad", ctr: 0.3 }), trap]);
    expect(v.status).toBe("trap");
    expect(v.primaryAction).toBeUndefined(); // 함정은 별도 실행 액션 없음(점검 안내)
  });

  it("N건 집계 — 손볼(trap/poor) 캠페인 수를 센다", () => {
    const v = deriveAccountVerdict([
      camp({ id: "bad1", ctr: 0.3 }),
      camp({ id: "bad2", ctr: 0.2 }),
      camp({ id: "good", ctr: 3.0 }),
    ]);
    expect(v.status).toBe("poor");
    expect(v.count).toBe(2);
  });

  it("전부 안정 → stable, count 0", () => {
    const v = deriveAccountVerdict([camp({ ctr: 1.0 })]);
    expect(v.status).toBe("stable");
    expect(v.count).toBe(0);
  });

  it("데이터 부족(노출 적음)만 있으면 collecting", () => {
    const v = deriveAccountVerdict([camp({ impressions: 100, clicks: 1, daysOfData: 1 })]);
    expect(v.status).toBe("collecting");
  });

  it("cruising 일 때 count = 호조 캠페인 수(늘려볼 만한 것)", () => {
    const v = deriveAccountVerdict([camp({ id: "g1", ctr: 3.0 }), camp({ id: "g2", ctr: 3.5 })]);
    expect(v.status).toBe("cruising");
    expect(v.count).toBe(2);
  });

  it("함정 → 근거 1줄에 실측 도착률 인용(ADR-031)", () => {
    const v = deriveAccountVerdict([
      camp({ id: "trap", ctr: 2.5, impressions: 20_000, linkClick: 1_000, landingPageView: 100 }),
    ]);
    expect(v.status).toBe("trap");
    expect(v.reasonLine).toContain("도착률 10%");
  });

  it("부진 → 근거 1줄에 1순위 제안 detail 첫 줄", () => {
    const v = deriveAccountVerdict([camp({ ctr: 0.3 })]);
    expect(v.status).toBe("poor");
    expect(v.reasonLine).toBeTruthy();
  });
});

describe("deriveHeroLayout", () => {
  it("trap/poor → rich + 액션·근거 노출", () => {
    const l = deriveHeroLayout({ status: "trap", headline: "h", count: 1, reasonLine: "도착률 낮음" });
    expect(l.density).toBe("rich");
    expect(l.showGrounding).toBe(true);
  });

  it("rich 인데 reasonLine 없으면 showGrounding=false", () => {
    const l = deriveHeroLayout({ status: "poor", headline: "h", count: 1 });
    expect(l.density).toBe("rich");
    expect(l.showGrounding).toBe(false);
  });

  it("poor + primaryAction 있으면 showAction=true", () => {
    const l = deriveHeroLayout({ status: "poor", headline: "h", count: 1, primaryAction: { campaignId: "c", kind: "pause", label: "정지" } });
    expect(l.showAction).toBe(true);
  });

  it("cruising/stable → calm, 액션 숨김", () => {
    expect(deriveHeroLayout({ status: "cruising", headline: "h", count: 1 }).density).toBe("calm");
    expect(deriveHeroLayout({ status: "stable", headline: "h", count: 0 }).showAction).toBe(false);
  });

  it("collecting → onboarding, 근거·액션 모두 숨김", () => {
    const l = deriveHeroLayout({ status: "collecting", headline: "h", count: 0 });
    expect(l.density).toBe("onboarding");
    expect(l.showAction).toBe(false);
    expect(l.showGrounding).toBe(false);
  });
});
