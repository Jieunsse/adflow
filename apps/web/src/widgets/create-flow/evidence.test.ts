import { describe, expect, it } from "vitest";
import { highlightSegments, proofUsage } from "./evidence";

const PROOFS = ["EWG 그린 등급 전성분", "비건 인증", "재구매율 38%"];

describe("proofUsage", () => {
  it("본문에 그대로 들어간 문구만 사용됨으로 본다", () => {
    const body = "EWG 그린 등급 전성분, 무향·무색소에 비건 인증까지 받았어요.";
    expect(proofUsage(body, PROOFS)).toEqual([
      { text: "EWG 그린 등급 전성분", used: true },
      { text: "비건 인증", used: true },
      { text: "재구매율 38%", used: false },
    ]);
  });

  it("빈 근거 문구는 버린다", () => {
    expect(proofUsage("아무 말", ["", "  "])).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("맞은 구간만 hit 로 잘라 준다", () => {
    expect(highlightSegments("앞 비건 인증 뒤", PROOFS)).toEqual([
      { text: "앞 ", hit: false },
      { text: "비건 인증", hit: true },
      { text: " 뒤", hit: false },
    ]);
  });

  it("겹치는 문구는 긴 쪽을 먼저 집는다", () => {
    const segs = highlightSegments("EWG 그린 등급 전성분입니다", ["EWG 그린 등급 전성분", "EWG"]);
    expect(segs[0]).toEqual({ text: "EWG 그린 등급 전성분", hit: true });
    expect(segs[1]).toEqual({ text: "입니다", hit: false });
  });

  it("맞는 게 없으면 통째로 한 조각", () => {
    expect(highlightSegments("근거 없는 문장", PROOFS)).toEqual([{ text: "근거 없는 문장", hit: false }]);
  });

  it("같은 문구가 여러 번 나와도 전부 집는다", () => {
    const segs = highlightSegments("비건 인증 그리고 비건 인증", ["비건 인증"]);
    expect(segs.filter((s) => s.hit)).toHaveLength(2);
  });
});
