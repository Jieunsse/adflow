import { describe, it, expect } from "vitest";
import {
  splitWindow,
  derivePeriodKpis,
  deltaTone,
  deriveConversionSummary,
  deriveRevenueRoasDelta,
  toCampaignTableRow,
  sortCampaignRows,
  type CampaignTableRow,
} from "./period-kpis";
import type { AccountDailyPoint } from "./account-trend";
import type { CampaignSummary } from "@/lib/meta-ads";

const pt = (date: string, p: Partial<AccountDailyPoint> = {}): AccountDailyPoint => ({
  date,
  spend: 0,
  impressions: 0,
  clicks: 0,
  landingPageView: 0,
  purchaseValue: 0,
  ...p,
});

describe("splitWindow", () => {
  it("날짜 정렬 후 뒤 periodDays=current, 그 앞=previous", () => {
    const daily = [pt("2026-06-04"), pt("2026-06-01"), pt("2026-06-03"), pt("2026-06-02")];
    const { current, previous } = splitWindow(daily, 2);
    expect(current.map((d) => d.date)).toEqual(["2026-06-03", "2026-06-04"]);
    expect(previous.map((d) => d.date)).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("이전 기간이 periodDays 를 못 채우면 빈 배열", () => {
    const daily = [pt("2026-06-03"), pt("2026-06-04")];
    const { current, previous } = splitWindow(daily, 2);
    expect(current).toHaveLength(2);
    expect(previous).toEqual([]);
  });
});

describe("derivePeriodKpis", () => {
  it("정상 델타 — 지출·노출·클릭 합산 후 증감률", () => {
    const current = [pt("d3", { spend: 200, impressions: 2000, clicks: 40 })];
    const previous = [pt("d1", { spend: 100, impressions: 1000, clicks: 20 })];
    const k = derivePeriodKpis(current, previous);
    expect(k.spend).toEqual({ value: 200, deltaPct: 100 });
    expect(k.impressions).toEqual({ value: 2000, deltaPct: 100 });
    expect(k.clicks).toEqual({ value: 40, deltaPct: 100 });
  });

  it("이전 기간 분모 0 이면 델타 생략", () => {
    const current = [pt("d2", { spend: 100, impressions: 1000, clicks: 10 })];
    const previous = [pt("d1", { spend: 0, impressions: 0, clicks: 0 })];
    const k = derivePeriodKpis(current, previous);
    expect(k.spend.deltaPct).toBeUndefined();
    expect(k.ctr.deltaPct).toBeUndefined();
    expect(k.cpc.deltaPct).toBeUndefined();
  });

  it("이전 기간 데이터 없음(빈 배열)이면 델타 생략, 현재값만", () => {
    const current = [pt("d1", { spend: 100, impressions: 1000, clicks: 10 })];
    const k = derivePeriodKpis(current, []);
    expect(k.spend).toEqual({ value: 100 });
    expect(k.ctr).toEqual({ value: 1 });
  });

  it("CTR = ΣClicks/ΣImpressions(일별 평균 아님)", () => {
    // 일별 ctr 평균이면 (100%+0%)/2=50% 가 되지만, 합산 방식은 10/1010 ≈ 0.99%
    const current = [
      pt("d1", { impressions: 10, clicks: 10 }),
      pt("d2", { impressions: 1000, clicks: 0 }),
    ];
    const k = derivePeriodKpis(current, []);
    expect(k.ctr.value).toBeCloseTo((10 / 1010) * 100, 5);
  });

  it("CPC·CPM 산출", () => {
    const current = [pt("d1", { spend: 1000, impressions: 5000, clicks: 20 })];
    const k = derivePeriodKpis(current, []);
    expect(k.cpc.value).toBe(50);
    expect(k.cpm.value).toBe(200);
  });
});

describe("deltaTone", () => {
  it("CTR·클릭 증가=positive, 감소=negative", () => {
    expect(deltaTone("ctr", 10)).toBe("positive");
    expect(deltaTone("ctr", -10)).toBe("negative");
    expect(deltaTone("clicks", 5)).toBe("positive");
  });

  it("CPC·CPM·CPA 증가=negative, 감소=positive(방향 반전)", () => {
    expect(deltaTone("cpc", 10)).toBe("negative");
    expect(deltaTone("cpc", -10)).toBe("positive");
    expect(deltaTone("cpm", 10)).toBe("negative");
    expect(deltaTone("cpa", -5)).toBe("positive");
  });

  it("0 은 neutral", () => {
    expect(deltaTone("ctr", 0)).toBe("neutral");
  });
});

const camp = (p: Partial<CampaignSummary>): CampaignSummary => ({
  id: "c1",
  name: "n",
  headline: "h",
  status: "live",
  objective: "OUTCOME_TRAFFIC",
  goal: "트래픽",
  startDate: null,
  endDate: null,
  adSetId: null,
  adId: null,
  dailyBudget: null,
  impressions: 0,
  clicks: 0,
  ctr: 0,
  spend: 0,
  issueReason: null,
  ...p,
});

describe("deriveConversionSummary", () => {
  it("전환 캠페인 없으면 null(게이트)", () => {
    expect(deriveConversionSummary([camp({ objective: "OUTCOME_TRAFFIC" })])).toBeNull();
  });

  it("전환 캠페인 있으면 합산 + ROAS/CPA 산출", () => {
    const campaigns = [
      camp({ objective: "OUTCOME_SALES", purchaseValue: 1000, purchaseCount: 10, spend: 200 }),
      camp({ objective: "OUTCOME_TRAFFIC", spend: 999 }),
    ];
    const s = deriveConversionSummary(campaigns)!;
    expect(s.count).toBe(1);
    expect(s.conversionValue).toBe(1000);
    expect(s.conversionSpend).toBe(200);
    expect(s.conversionCount).toBe(10);
    expect(s.roas).toBe(5);
    expect(s.cpa).toBe(20);
  });
});

describe("deriveRevenueRoasDelta", () => {
  it("이전 기간 없으면 매출 현재값만, roasApprox 없음", () => {
    const current = [pt("d1", { purchaseValue: 500, spend: 100 })];
    const r = deriveRevenueRoasDelta(current, []);
    expect(r.revenue).toEqual({ value: 500 });
    expect(r.roasApprox).toBeUndefined();
  });

  it("매출·ROAS 근사 델타 산출", () => {
    const current = [pt("d2", { purchaseValue: 400, spend: 100 })];
    const previous = [pt("d1", { purchaseValue: 200, spend: 100 })];
    const r = deriveRevenueRoasDelta(current, previous);
    expect(r.revenue.deltaPct).toBe(100);
    expect(r.roasApprox).toBe(100);
  });
});

describe("toCampaignTableRow / sortCampaignRows", () => {
  it("전환 캠페인 아니면 purchaseCount/roas=null", () => {
    const row = toCampaignTableRow(camp({ objective: "OUTCOME_TRAFFIC", spend: 100, clicks: 10 }));
    expect(row.purchaseCount).toBeNull();
    expect(row.roas).toBeNull();
    expect(row.cpc).toBe(10);
  });

  it("전환 캠페인이면 purchaseCount/roas 산출", () => {
    const row = toCampaignTableRow(
      camp({ objective: "OUTCOME_SALES", purchaseValue: 500, purchaseCount: 5, spend: 100 }),
    );
    expect(row.purchaseCount).toBe(5);
    expect(row.roas).toBe(5);
  });

  it("linkClick 미측정이면 landingRate=null(측정 안 됨, 0 아님)", () => {
    const row = toCampaignTableRow(camp({}));
    expect(row.landingRate).toBeNull();
  });

  it("linkClick 측정 시 landingRate = landingPageView/linkClick", () => {
    const row = toCampaignTableRow(camp({ linkClick: 40, landingPageView: 10 }));
    expect(row.landingRate).toBe(0.25);
  });

  it("기본 정렬: 지출 내림차순", () => {
    const rows: CampaignTableRow[] = [
      toCampaignTableRow(camp({ id: "a", spend: 100 })),
      toCampaignTableRow(camp({ id: "b", spend: 300 })),
      toCampaignTableRow(camp({ id: "c", spend: 200 })),
    ];
    const sorted = sortCampaignRows(rows, "spend", "desc");
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("asc/desc 토글", () => {
    const rows: CampaignTableRow[] = [
      toCampaignTableRow(camp({ id: "a", spend: 100 })),
      toCampaignTableRow(camp({ id: "b", spend: 300 })),
    ];
    expect(sortCampaignRows(rows, "spend", "asc").map((r) => r.id)).toEqual(["a", "b"]);
  });
});
