import { describe, expect, it } from "vitest";
import { evidenceNote, lengthNote, openingStyle, savedAgoLabel } from "./copy-diff";

describe("openingStyle", () => {
  it("훅마다 다른 문구를 준다", () => {
    expect(openingStyle("trendy")).toBe("유행 언급으로 관심 끌기");
    expect(openingStyle("story")).toBe("고민 공감으로 시작");
  });

  it("훅이 없으면 단정하지 않는다", () => {
    expect(openingStyle(null)).toBe("—");
  });
});

describe("lengthNote", () => {
  it("글자 수는 실측, 성격은 훅에서 온다", () => {
    expect(lengthNote("가나다라", "trendy")).toBe("4자 · 짧고 빠름");
  });

  it("훅을 모르면 글자 수만 적는다", () => {
    expect(lengthNote("가나다라", null)).toBe("4자");
  });

  it("본문이 비었으면 빈 칸으로 둔다", () => {
    expect(lengthNote("", "story")).toBe("—");
    expect(lengthNote(null, "story")).toBe("—");
  });
});

describe("evidenceNote", () => {
  it("생성기가 알려주지 않으면 인용됐다고 말하지 않는다", () => {
    expect(evidenceNote(undefined)).toBe("확인 안 됨");
  });

  it("알려준 대로 적는다", () => {
    expect(evidenceNote(true)).toBe("근거 자료 인용됨");
    expect(evidenceNote(false)).toBe("근거 인용 없음");
  });
});

describe("savedAgoLabel", () => {
  const now = 1_700_000_000_000;

  it("아직 저장 전이면 pill 을 감춘다", () => {
    expect(savedAgoLabel(null, now)).toBeNull();
  });

  it("1분 안쪽은 방금", () => {
    expect(savedAgoLabel(now - 30_000, now)).toBe("자동 저장됨 · 방금");
  });

  it("분·시간 단위로 접는다", () => {
    expect(savedAgoLabel(now - 5 * 60_000, now)).toBe("자동 저장됨 · 5분 전");
    expect(savedAgoLabel(now - 125 * 60_000, now)).toBe("자동 저장됨 · 2시간 전");
  });
});
