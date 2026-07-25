import { describe, it, expect } from "vitest";
import { resolveAnchor, pickTemplate, TEMPLATES } from "./TextOverlayEditor";

describe("resolveAnchor", () => {
  // center = 현행 비트동일: textAlign center, x = 앵커(cx) 그대로.
  it("center 는 앵커 중심을 x 로 쓴다", () => {
    expect(resolveAnchor("center", 512, 300)).toEqual({ textAlign: "center", x: 512 });
  });

  it("left 는 좌모서리(앵커=x) + textAlign left", () => {
    expect(resolveAnchor("left", 100, 300)).toEqual({ textAlign: "left", x: 100 });
  });

  it("right 는 우모서리(앵커=x) + textAlign right", () => {
    expect(resolveAnchor("right", 900, 300)).toEqual({ textAlign: "right", x: 900 });
  });

  it("maxW 는 앵커 좌표에 영향을 주지 않는다(transform/textAlign 이 정렬 흡수)", () => {
    expect(resolveAnchor("left", 100, 999).x).toBe(100);
    expect(resolveAnchor("right", 900, 999).x).toBe(900);
  });
});

describe("pickTemplate", () => {
  it("A(하단 밴드) 주표제는 center 정렬", () => {
    const blocks = pickTemplate("A", "테스트 표제");
    expect(blocks[0].align).toBe("center");
    expect(blocks[0].text).toBe("테스트 표제");
  });

  it("E(좌하단) 두 블록 모두 left 정렬·xPct 6", () => {
    const blocks = pickTemplate("E", "좌측 표제");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.align === "left")).toBe(true);
    expect(blocks.every((b) => b.xPct === 6)).toBe(true);
    expect(blocks[0].text).toBe("좌측 표제");
  });

  it("E 밴드는 bottom", () => {
    expect(TEMPLATES.E.band).toBe("bottom");
  });

  it("headline 없으면 placeholder 주입", () => {
    expect(pickTemplate("C")[0].text).toBe("여기에 표제를 입력하세요");
  });

  it("D(빈 시작)는 블록 0", () => {
    expect(pickTemplate("D")).toHaveLength(0);
  });
});
