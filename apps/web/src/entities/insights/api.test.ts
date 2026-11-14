import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountTrend, fetchAnalysisTrend, insightsKeys } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("insights api", () => {
  it("조회 키와 쿼리 파라미터를 같은 규칙으로 만든다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ daily: [] }), { status: 200 }),
    ));

    await fetchAccountTrend(14, "good");
    expect(fetch).toHaveBeenCalledWith("/api/dashboard/trend?days=14&example=good");
    expect(insightsKeys.accountTrend(14, "good")).toEqual(["dashboard", "trend", 14, "good"]);
  });

  it("분석 응답 오류를 예외로 올린다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "분석 실패" }), { status: 500 }),
    ));

    await expect(fetchAnalysisTrend(60)).rejects.toThrow("분석 실패");
  });
});
