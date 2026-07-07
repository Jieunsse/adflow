import { describe, it, expect } from "vitest";
import {
  buildPerCreatorRows,
  serializeInfluencerReportText,
  toInfluencerCampaignCsv,
  type InfluencerCampaignReport,
} from "./report";
import type { Creator } from "@entities/creator/model";
import type { InfluencerCampaign } from "./model";

const creators: Creator[] = [
  {
    id: "c1",
    handle: "@a",
    platform: "instagram",
    category: [],
    performanceHistory: [],
    createdAt: "2026-01-01T00:00:00Z",
  },
];

const campaign: InfluencerCampaign = {
  id: "camp1",
  name: "테스트 캠페인",
  goal: "인지도",
  brandProfileId: "bp1",
  createdAt: "2026-01-01T00:00:00Z",
  entries: [
    {
      creatorId: "c1",
      stage: "settled",
      performance: { campaignId: "camp1", reach: 100, clicks: 10, conversions: 2, recordedAt: "2026-01-02T00:00:00Z" },
      updatedAt: "2026-01-02T00:00:00Z",
    },
    {
      creatorId: "c-deleted",
      stage: "published",
      performance: { campaignId: "camp1", reach: 50, recordedAt: "2026-01-02T00:00:00Z" },
      updatedAt: "2026-01-02T00:00:00Z",
    },
    {
      creatorId: "c-no-perf",
      stage: "candidate",
      updatedAt: "2026-01-02T00:00:00Z",
    },
  ],
};

describe("buildPerCreatorRows", () => {
  it("performance 없는 entry 는 제외한다", () => {
    const rows = buildPerCreatorRows(campaign, creators);
    expect(rows).toHaveLength(2);
  });

  it("매칭되는 creator 없으면 삭제됨 표기", () => {
    const rows = buildPerCreatorRows(campaign, creators);
    expect(rows.find((r) => r.handle === "(삭제된 크리에이터)")).toBeTruthy();
  });

  it("매칭되면 실제 핸들을 쓴다", () => {
    const rows = buildPerCreatorRows(campaign, creators);
    expect(rows.find((r) => r.handle === "@a")).toBeTruthy();
  });
});

describe("serializeInfluencerReportText", () => {
  const base: InfluencerCampaignReport = {
    campaignName: "테스트 캠페인",
    aggregated: { reach: 150, clicks: 10, conversions: 2 },
    perCreator: [{ handle: "@a", stage: "settled", reach: 100, conversions: 2 }],
    insight: null,
  };

  it("ROAS 미입력이면 ROAS 줄이 없다", () => {
    const text = serializeInfluencerReportText(base);
    expect(text).not.toContain("ROAS");
  });

  it("revenue/cost 있으면 ROAS 를 포함한다", () => {
    const text = serializeInfluencerReportText({
      ...base,
      aggregated: { reach: 150, clicks: 10, conversions: 2, revenue: 200, cost: 100, roas: 2 },
    });
    expect(text).toContain("ROAS 2.00x");
  });

  it("insight 있으면 AI 요약 섹션을 붙인다", () => {
    const text = serializeInfluencerReportText({
      ...base,
      insight: { headline: "요약", insights: ["포인트1"] },
    });
    expect(text).toContain("[AI 요약]");
    expect(text).toContain("포인트1");
  });
});

describe("toInfluencerCampaignCsv", () => {
  it("BOM 과 헤더를 포함한다", () => {
    const csv = toInfluencerCampaignCsv([{ handle: "@a", stage: "settled", reach: 100 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("핸들,단계,도달,클릭,전환,매출,협업비");
  });

  it("빈 값은 빈 셀로 렌더한다", () => {
    const csv = toInfluencerCampaignCsv([{ handle: "@a", stage: "candidate" }]);
    const line = csv.split("\n")[1];
    expect(line).toBe("@a,candidate,,,,,");
  });
});
