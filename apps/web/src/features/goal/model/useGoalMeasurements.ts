"use client";

// 목표 화면 3종(목록·세우기 위저드·추적)이 같은 실측을 보게 하는 단일 진입점.
// 화면마다 따로 fetch 하면 같은 숫자가 화면별로 어긋난다 — 여기서 한 번만 계산해 내려보낸다.

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { CampaignSummary } from "@/lib/meta-ads";
import type { BackcastInputs } from "@entities/insights/backcast";
import { splitWindow, derivePeriodKpis, deriveConversionSummary, deriveRevenueRoasDelta } from "@entities/insights/period-kpis";
import { listBrowse } from "@entities/campaign/browse/store";
import { seedAutoPilotDemo } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import { fetchCampaigns } from "@entities/campaign/api";
import { fetchAccountTrend, insightsKeys } from "@entities/insights/api";
import { useGoalsStorage } from "./useGoalsStorage";

const PERIOD_DAYS = 30;
const TREND_DAYS = 60;

async function fetchGoalCampaigns(): Promise<CampaignSummary[]> {
  try {
    return await fetchCampaigns("30d");
  } catch (error) {
    if ((error as { code?: number }).code === 401) return [];
    throw error;
  }
}

export type GoalMeasurements = ReturnType<typeof useGoalMeasurements>;

export function useGoalMeasurements() {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const store = useGoalsStorage(browseMode);

  // 둘러보기 시드도 쿼리로 — localStorage 접근이라 서버에선 못 읽고, 마운트 후 한 번만 읽으면 된다.
  const browseQ = useQuery({
    queryKey: ["browse", "campaigns"],
    queryFn: async () => {
      seedAutoPilotDemo();
      return listBrowse().map(browseCampaignToSummary);
    },
    enabled: browseMode,
    staleTime: 60_000,
  });
  const browseRows = browseQ.data;

  const enabled = !!session?.adAccountId || browseMode;
  const campaignsQ = useQuery({ queryKey: ["goal", "campaigns", "30d"], queryFn: fetchGoalCampaigns, enabled, staleTime: 60_000 });
  const trendQ = useQuery({ queryKey: insightsKeys.accountTrend(TREND_DAYS), queryFn: () => fetchAccountTrend(TREND_DAYS), enabled, staleTime: 5 * 60_000 });

  const campaigns = useMemo(
    () => (browseMode ? [...(browseRows ?? []), ...(campaignsQ.data ?? [])] : campaignsQ.data ?? []),
    [browseMode, browseRows, campaignsQ.data],
  );
  const dailyAll = useMemo(() => trendQ.data ?? [], [trendQ.data]);

  const { current: dailyCurrent, previous: dailyPrevious } = useMemo(
    () => splitWindow(dailyAll, PERIOD_DAYS),
    [dailyAll],
  );
  const periodKpis = useMemo(() => derivePeriodKpis(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);
  const conversion = useMemo(() => deriveConversionSummary(campaigns), [campaigns]);
  const roasDelta = useMemo(() => deriveRevenueRoasDelta(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);

  // 계정 전체 CVR = ΣpurchaseCount / ΣlinkClick — deriveConversionSummary 와 동일한 합산 패턴(캠페인별 평균 아님).
  const cvr = useMemo(() => {
    const measured = campaigns.filter((c) => c.linkClick != null && c.purchaseCount != null);
    if (measured.length === 0) return undefined;
    const totalLinkClick = measured.reduce((s, c) => s + (c.linkClick ?? 0), 0);
    const totalPurchase = measured.reduce((s, c) => s + (c.purchaseCount ?? 0), 0);
    return totalLinkClick > 0 ? totalPurchase / totalLinkClick : undefined;
  }, [campaigns]);

  const hasDaily = dailyCurrent.length > 0;
  const inputs: BackcastInputs = useMemo(
    () => ({
      aov: conversion && conversion.conversionCount > 0 ? conversion.conversionValue / conversion.conversionCount : undefined,
      cvr,
      ctr: hasDaily ? periodKpis.ctr.value : undefined,
      cpc: hasDaily ? periodKpis.cpc.value : undefined,
      cpm: hasDaily ? periodKpis.cpm.value : undefined,
    }),
    [conversion, cvr, hasDaily, periodKpis],
  );

  const current = useMemo(
    () => ({ roas: conversion?.roas ?? null, cpa: conversion?.cpa ?? null }),
    [conversion],
  );

  const activeCampaigns = useMemo(() => campaigns.filter((c) => c.status === "live"), [campaigns]);
  const totalDailyBudget = useMemo(() => {
    const withBudget = activeCampaigns.filter((c) => c.dailyBudget != null);
    return withBudget.length === 0 ? null : withBudget.reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
  }, [activeCampaigns]);

  return {
    ...store,
    browseMode,
    loading: campaignsQ.isLoading || trendQ.isLoading,
    campaigns,
    dailyCurrent,
    periodKpis,
    conversion,
    roasDeltaPct: roasDelta.roasApprox,
    /** 역산 지도 인풋 — 실측이 없는 항목은 undefined 로 비운다(0 으로 채우지 않는다). */
    inputs,
    /** 후행 목표 실측 */
    current,
    activeCampaignCount: activeCampaigns.length,
    totalDailyBudget,
    totalSpend: useMemo(() => dailyCurrent.reduce((s, d) => s + d.spend, 0), [dailyCurrent]),
  };
}
