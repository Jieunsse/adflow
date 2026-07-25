import { describe, it, expect } from "vitest";
import { isFakePerformance } from "./fake-performance";

// CTR 2% 통과 + 도착률 35% (<50%) = 가짜 성과 의심.
const FAKE = { impressions: 184320, ctr: 2.67, linkClick: 4200, landingPageView: 1470 };

describe("isFakePerformance", () => {
  it("Vanity ✓ + Substance ✗ → 의심 + evidence", () => {
    const r = isFakePerformance(FAKE, 21);
    expect(r.fake).toBe(true);
    expect(r.evidence).toEqual({ ctr: 2.67, landingRate: 35, dropRate: 65 });
  });

  it("CTR 미달(Vanity ✗) → 의심 아님 (이건 그냥 성과 나쁨 = pause 영역)", () => {
    expect(isFakePerformance({ ...FAKE, ctr: 1.2 }, 21).fake).toBe(false);
  });

  it("도착률 ≥ 50%(Substance ✓) → Winner 쪽이라 의심 아님", () => {
    expect(isFakePerformance({ ...FAKE, landingPageView: 3000 }, 21).fake).toBe(false);
  });

  it("landing_page_view action 부재(undefined) → 픽셀 미측정 → 판정 안 함", () => {
    expect(isFakePerformance({ ...FAKE, landingPageView: undefined }, 21).fake).toBe(false);
  });

  it("landing_page_view 0 은 측정됨 → 도착률 0% 라 의심", () => {
    expect(isFakePerformance({ ...FAKE, landingPageView: 0 }, 21).fake).toBe(true);
  });

  it("표본 가드 — link_click < 50 → 판정 안 함", () => {
    expect(isFakePerformance({ ...FAKE, linkClick: 40, landingPageView: 5 }, 21).fake).toBe(false);
  });

  it("게이트 — 노출 < 1,000 → 판정 안 함", () => {
    expect(isFakePerformance({ ...FAKE, impressions: 800 }, 21).fake).toBe(false);
  });

  it("게이트 — 집행 < 3일 → 판정 안 함", () => {
    expect(isFakePerformance(FAKE, 2).fake).toBe(false);
  });
});
