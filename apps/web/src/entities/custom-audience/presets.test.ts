import { describe, expect, it } from "vitest";
import { AUDIENCE_PRESETS, presetAudienceName, presetOf } from "./presets";

describe("presetAudienceName", () => {
  it("결정적 이름을 생성한다 (라벨 · 보존기간 고정 포맷)", () => {
    const preset = presetOf("website_visitors");
    expect(presetAudienceName(preset)).toBe("AdFlow · 우리 사이트에 다녀간 사람 · 30일");
  });

  it("같은 프리셋이면 항상 같은 이름 — 멱등 생성의 근거", () => {
    const a = presetAudienceName(presetOf("purchasers"));
    const b = presetAudienceName(presetOf("purchasers"));
    expect(a).toBe(b);
  });
});

describe("픽셀 게이트 판정", () => {
  it("ig_engagers 는 픽셀이 필요 없다", () => {
    expect(presetOf("ig_engagers").requiresPixel).toBe(false);
  });

  it("website_visitors/purchasers 는 픽셀이 필요하다", () => {
    expect(presetOf("website_visitors").requiresPixel).toBe(true);
    expect(presetOf("purchasers").requiresPixel).toBe(true);
  });
});

describe("presetOf", () => {
  it("알 수 없는 id 면 던진다", () => {
    // @ts-expect-error — 잘못된 id 로 방어 로직 검증
    expect(() => presetOf("unknown")).toThrow();
  });

  it("프리셋은 정확히 3종 고정이다", () => {
    expect(AUDIENCE_PRESETS).toHaveLength(3);
  });
});
