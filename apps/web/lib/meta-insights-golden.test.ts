// 골든 픽스처 — Meta 응답 파싱을 잠근다 (단계 6).
//
// 게재(요청 바디)와 달리 여기 위험은 **응답 파싱**이다. ad study 결과는 버전·계정마다 모양 편차가 커서
// 파서가 일부러 관대하고(셀 이름 정규화·confidence/p_value 폴백), 광고별 KPI 는 반올림 규칙이 계약이다.
// 그 관대함과 반올림을 Java 재작성본이 똑같이 재현하는지 같은 파일로 지킨다.
//
// 원본(raw)은 손으로 적은 입력이고, 기대값(expected)은 이 클라이언트에서 떠낸 것이다.
//
// 대응 Java: apps/api/src/test/java/ai/adflow/api/meta/MetaInsightsGoldenTest.java

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metaAdsInsights } from "./meta-ads-insights";

type StudyCase = { name: string; raw: unknown; expected: { winner: "A" | "B" | null; confidence: number } | null };
type AdCase = { name: string; adIds: [string, string]; raw: unknown; expected: unknown };

const FIXTURE = join(__dirname, "../../../packages/contracts/fixtures/meta/insights.json");
const { adStudy, adInsights } = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
  adStudy: StudyCase[];
  adInsights: AdCase[];
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("ad study 결과 파싱 골든 픽스처", () => {
  it("케이스가 비어 있지 않다", () => {
    expect(adStudy.length).toBeGreaterThanOrEqual(10);
  });

  for (const c of adStudy) {
    it(c.name, async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => c.raw });
      expect(await metaAdsInsights.getSplitTestResult("s1", "TOKEN")).toEqual(c.expected);
    });
  }
});

describe("광고별 KPI 파싱 골든 픽스처", () => {
  it("케이스가 비어 있지 않다", () => {
    expect(adInsights.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of adInsights) {
    it(c.name, async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => c.raw });
      const insights = await metaAdsInsights.getInsights("camp_1", "TOKEN", "all", undefined, "traffic", c.adIds);
      expect(insights.ads).toEqual(c.expected);
    });
  }
});
