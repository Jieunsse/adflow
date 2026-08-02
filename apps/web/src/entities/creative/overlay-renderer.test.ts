import { describe, expect, it } from "vitest";
import { pickTemplate, resolveAnchor, TEMPLATES } from "./overlay-renderer";

describe("overlay renderer", () => {
  it("center 앵커는 중심 x를 그대로 쓴다", () => {
    expect(resolveAnchor("center", 512, 300)).toEqual({ textAlign: "center", x: 512 });
  });

  it("left와 right 앵커는 정렬을 유지한다", () => {
    expect(resolveAnchor("left", 100, 300)).toEqual({ textAlign: "left", x: 100 });
    expect(resolveAnchor("right", 900, 300)).toEqual({ textAlign: "right", x: 900 });
  });

  it("하단 밴드 템플릿은 표제를 center 정렬로 시드한다", () => {
    const blocks = pickTemplate("A", "테스트 표제");
    expect(blocks[0]).toMatchObject({ align: "center", text: "테스트 표제" });
    expect(TEMPLATES.A.band).toBe("bottom");
  });

  it("좌하단 템플릿은 두 블록을 left 정렬로 시드한다", () => {
    const blocks = pickTemplate("E", "좌측 표제");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.align === "left" && b.xPct === 6)).toBe(true);
  });

  it("빈 시작 템플릿은 블록을 만들지 않는다", () => {
    expect(pickTemplate("D")).toEqual([]);
  });
});
