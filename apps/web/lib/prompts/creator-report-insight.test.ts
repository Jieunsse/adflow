import { describe, expect, it } from "vitest";
import { parseReportInsight } from "./creator-report-insight";

describe("parseReportInsight", () => {
  it("headline·insights 를 그대로 반환", () => {
    const result = parseReportInsight(
      JSON.stringify({ headline: "전환 순항 중", insights: ["도달 대비 전환율이 높아요."] }),
    );
    expect(result.headline).toBe("전환 순항 중");
    expect(result.insights).toEqual(["도달 대비 전환율이 높아요."]);
  });

  it("insights 가 빈 배열이면 throw", () => {
    expect(() => parseReportInsight(JSON.stringify({ headline: "요약", insights: [] }))).toThrow();
  });

  it("headline 없으면 throw", () => {
    expect(() => parseReportInsight(JSON.stringify({ insights: ["a"] }))).toThrow();
  });

  it("JSON 파싱 실패 시 throw", () => {
    expect(() => parseReportInsight("not json")).toThrow();
  });
});
