import { describe, it, expect } from "vitest";
import { buildRecent7Report, serializeReportText, toCampaignsCsv, type BuildRecent7ReportInput } from "./report";
import type { AccountDailyPoint } from "./account-trend";
import type { PeriodKpis, CampaignTableRow } from "./period-kpis";
import type { AccountVerdict } from "./account-verdict";

const pt = (date: string): AccountDailyPoint => ({ date, spend: 0, impressions: 0, clicks: 0, landingPageView: 0, purchaseValue: 0 });

const kpis: PeriodKpis = {
  spend: { value: 100000, deltaPct: 10 },
  impressions: { value: 10000 },
  clicks: { value: 200, deltaPct: -5 },
  ctr: { value: 2 },
  cpc: { value: 500 },
  cpm: { value: 1000 },
};

const verdict: AccountVerdict = { status: "poor", headline: "지금 손볼 캠페인 1건", count: 1 };

const row = (p: Partial<CampaignTableRow> & { id: string }): CampaignTableRow => ({
  id: p.id,
  headline: p.headline ?? p.id,
  status: p.status ?? "live",
  spend: p.spend ?? 0,
  impressions: p.impressions ?? 0,
  clicks: p.clicks ?? 0,
  ctr: p.ctr ?? 0,
  cpc: p.cpc ?? 0,
  isConversion: p.isConversion ?? false,
  purchaseCount: p.purchaseCount ?? null,
  roas: p.roas ?? null,
  landingRate: p.landingRate ?? null,
});

function baseInput(over: Partial<BuildRecent7ReportInput> = {}): BuildRecent7ReportInput {
  return {
    current: [pt("2026-06-29"), pt("2026-07-05")],
    previous: [pt("2026-06-22"), pt("2026-06-28")],
    kpis,
    verdict,
    campaignRows: [
      row({ id: "a", headline: "A", spend: 300 }),
      row({ id: "b", headline: "B", spend: 100 }),
      row({ id: "c", headline: "C", spend: 500 }),
      row({ id: "d", headline: "D", spend: 50 }),
    ],
    campaignVerdicts: [],
    ...over,
  };
}

describe("buildRecent7Report", () => {
  it("날짜 범위 = M/D–M/D 포맷", () => {
    const r = buildRecent7Report(baseInput());
    expect(r.currentRangeLabel).toBe("6/29–7/5");
    expect(r.previousRangeLabel).toBe("6/22–6/28");
  });

  it("지출 상위 3 정렬(중립 지표 단일 랭킹)", () => {
    const r = buildRecent7Report(baseInput());
    expect(r.topSpendCampaigns.map((c) => c.headline)).toEqual(["C", "A", "B"]);
  });

  it("손볼 캠페인 = poor/trap 필터, 다른 상태는 제외", () => {
    const r = buildRecent7Report(
      baseInput({
        campaignVerdicts: [
          { campaign: { id: "x", headline: "X", status: "live", objective: "OUTCOME_TRAFFIC", impressions: 0, clicks: 0, ctr: 0, spend: 0, dailyBudget: null, adSetId: null, daysOfData: 7 }, status: "poor", headline: "부진" },
          { campaign: { id: "y", headline: "Y", status: "live", objective: "OUTCOME_TRAFFIC", impressions: 0, clicks: 0, ctr: 0, spend: 0, dailyBudget: null, adSetId: null, daysOfData: 7 }, status: "trap", headline: "함정" },
          { campaign: { id: "z", headline: "Z", status: "live", objective: "OUTCOME_TRAFFIC", impressions: 0, clicks: 0, ctr: 0, spend: 0, dailyBudget: null, adSetId: null, daysOfData: 7 }, status: "cruising", headline: "호조" },
        ],
      }),
    );
    expect(r.attentionCampaigns.map((c) => c.headline)).toEqual(["X", "Y"]);
  });

  it("마진율 없으면 profit=null", () => {
    const r = buildRecent7Report(baseInput());
    expect(r.profit).toBeNull();
  });

  it("마진율 있으면 profit 산출", () => {
    const r = buildRecent7Report(baseInput({ marginRate: 0.3, conversionValue: 1000, conversionSpend: 200 }));
    expect(r.profit).not.toBeNull();
    expect(r.profit?.marginRatePct).toBe(30);
  });

  it("previous 빈 배열이면 previousRangeLabel=null", () => {
    const r = buildRecent7Report(baseInput({ previous: [] }));
    expect(r.previousRangeLabel).toBeNull();
  });
});

describe("serializeReportText", () => {
  it("델타 없는 KPI 는 괄호 델타 생략(값만)", () => {
    const r = buildRecent7Report(baseInput());
    const text = serializeReportText(r);
    expect(text).toContain("노출: 10,000");
    expect(text).not.toContain("노출: 10,000 (");
  });

  it("델타 있는 KPI 는 부호 포함 표기", () => {
    const r = buildRecent7Report(baseInput());
    const text = serializeReportText(r);
    expect(text).toContain("지출: ₩100,000 (+10.0%)");
    expect(text).toContain("클릭: 200 (-5.0%)");
  });

  it("손볼 캠페인 없으면 섹션 자체 생략", () => {
    const r = buildRecent7Report(baseInput());
    const text = serializeReportText(r);
    expect(text).not.toContain("[손볼 캠페인");
  });
});

describe("toCampaignsCsv", () => {
  it("BOM 포함", () => {
    const csv = toCampaignsCsv([row({ id: "a" })]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("null/undefined 는 빈 셀(0 아님)", () => {
    const csv = toCampaignsCsv([row({ id: "a", purchaseCount: null, roas: null, landingRate: null })]);
    const dataLine = csv.split("\n")[1];
    const cells = dataLine.split(",");
    expect(cells[cells.length - 3]).toBe(""); // 전환
    expect(cells[cells.length - 2]).toBe(""); // ROAS
    expect(cells[cells.length - 1]).toBe(""); // 도착률
  });

  it("값 있으면 정상 셀 채움", () => {
    const csv = toCampaignsCsv([row({ id: "a", headline: "캠페인A", spend: 1000, purchaseCount: 5, roas: 3.456, landingRate: 0.5 })]);
    expect(csv).toContain("캠페인A");
    expect(csv).toContain("3.46");
    expect(csv).toContain("50");
  });

  it("헤더 한국어", () => {
    const csv = toCampaignsCsv([]);
    expect(csv).toContain("캠페인명,상태,지출,노출,클릭,CTR,CPC,전환,ROAS,도착률");
  });
});
