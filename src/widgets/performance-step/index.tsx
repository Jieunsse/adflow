"use client";

// STEP 03 성과 확인 widget — ADR-001 §deepening ③.
// useCreative legacy shim 대신 useLaunchDraft + useCreativeDraft 직접 구독.

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useCreativeDraft } from "@entities/creative/model";
import { abVariantLabel, useLaunchDraft } from "@entities/campaign/model";
import { useToast } from "@shared/ui/Toast";
import { suggestOptimizations, assessAutomationReadiness } from "@entities/insights/optimization";
import { addNotification } from "@shared/lib/notifications";
import { shortDate } from "@shared/lib/format";

import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import CampaignBar from "./CampaignBar";
import ExampleBanner from "./ExampleBanner";
import KpiGrid from "./KpiGrid";
import OptimizationPanel from "./OptimizationPanel";
import DailyTrend from "./DailyTrend";
import AbTestResultCard from "./AbTestResultCard";
import type { Insights, CampaignObjective, AdInsightsRow } from "@entities/insights/types";
import { judgeAbTest, rowToKpi } from "@entities/insights/ab-verdict";
import { seedMockAdRows } from "@/lib/mock-campaigns";

type ControlParams = {
  campaignId: string; adSetId: string; adId?: string;
  action: "pause" | "resume" | "set-daily-budget"; dailyBudget?: number;
};
type ControlResult = { ok: true; status?: "ACTIVE" | "PAUSED"; dailyBudget?: number };

const SCENARIOS: Record<"good" | "poor", Insights> = {
  good: {
    impressions: 184320, clicks: 4926, ctr: 2.67, spend: 482000,
    daily: [
      ["5/8", 268, 2.4, 32100], ["5/9", 296, 2.5, 34800], ["5/10", 312, 2.55, 36200], ["5/11", 340, 2.6, 38800],
      ["5/12", 358, 2.65, 41500], ["5/13", 390, 2.7, 44200], ["5/14", 408, 2.72, 46800], ["5/15", 422, 2.74, 48200],
      ["5/16", 446, 2.76, 50100], ["5/17", 462, 2.78, 51400], ["5/18", 478, 2.8, 52600],
    ].map(([date, clicks, ctr, spend]) => ({ date: String(date), clicks: Number(clicks), ctr: Number(ctr), spend: Number(spend) })),
  },
  poor: {
    impressions: 47200, clicks: 282, ctr: 0.6, spend: 614000,
    daily: [
      ["5/8", 38, 0.95, 56200], ["5/9", 35, 0.88, 56000], ["5/10", 32, 0.82, 55900], ["5/11", 30, 0.76, 55800],
      ["5/12", 27, 0.7, 55800], ["5/13", 25, 0.64, 55700], ["5/14", 23, 0.58, 55600], ["5/15", 21, 0.53, 55500],
      ["5/16", 19, 0.48, 55400], ["5/17", 17, 0.44, 55300], ["5/18", 15, 0.4, 55200],
    ].map(([date, clicks, ctr, spend]) => ({ date: String(date), clicks: Number(clicks), ctr: Number(ctr), spend: Number(spend) })),
  },
};

export default function PerformanceStep({ onRestart }: { onRestart: () => void }) {
  const { state: creativeState } = useCreativeDraft();
  const { state: launchState, dispatch: launchDispatch } = useLaunchDraft();
  const showToast = useToast();
  const router = useRouter();

  const launched = launchState.launchedCampaign;
  const headline = creativeState.headline;
  const exampleMode = !launched;
  const [scenario, setScenario] = useState<"good" | "poor">("good");
  const objective: CampaignObjective = launched?.objective ?? "OUTCOME_TRAFFIC";
  // PRD §13 — goal 단위 인사이트. launched 캠페인에 goalId 가 저장됐으면 그것으로, 아니면 objective 폴백.
  const goalId = launched?.goalId;

  // PRD-ab-testing.md §7.2 — adIds 있으면 ?adIds=a,b 로 광고별 row 동반.
  const adIdsParam = launched?.adIds ? `&adIds=${launched.adIds[0]},${launched.adIds[1]}` : "";
  const q = useQuery<Insights>({
    queryKey: ["insights", launched?.campaignId, objective, goalId, launched?.adIds?.join(",")],
    enabled: !!launched,
    queryFn: async () => {
      const url = `/api/insights/${launched!.campaignId}?objective=${objective}${goalId ? `&goal=${goalId}` : ""}${adIdsParam}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "성과를 불러오지 못했어요");
      return data as Insights;
    },
  });

  // PRD-ab-testing.md §7.5 — server 가 fake adIds 면 ads 비워줌. client 가 launched.startDate 로 광고별 row 합성.
  const insightsWithAds = useMemo<Insights | undefined>(() => {
    if (!q.data || !launched?.adIds) return q.data;
    if (q.data.ads) return q.data;
    const isFakeAd = launched.adIds.every((a) => a.startsWith("mock_ad_"));
    if (!isFakeAd) return q.data;
    const ads = seedMockAdRows(launched.campaignId, launched.startDate, launched.adIds);
    return { ...q.data, ads };
  }, [q.data, launched]);

  const control = useApiMutation<ControlParams, ControlResult>("/api/campaign/control");

  const applyControl = (params: Omit<ControlParams, "campaignId" | "adSetId" | "adId">, successMsg: string) => {
    if (!launched) return;
    control.mutate(
      { campaignId: launched.campaignId, adSetId: launched.adSetId, adId: launched.adId, ...params },
      {
        onSuccess: (res) => {
          launchDispatch({
            type: "SET_LAUNCHED_CAMPAIGN",
            value: {
              ...launched,
              ...(res.status ? { status: res.status } : {}),
              ...(typeof res.dailyBudget === "number" ? { dailyBudget: res.dailyBudget } : {}),
            },
          });
          showToast(successMsg);
          q.refetch();
        },
        onError: (err) => showToast(err instanceof Error ? err.message : "적용에 실패했어요"),
      },
    );
  };

  const periodLabel = launched ? `${launched.startDate} ~ ${launched.endDate}` : "5월 8일 – 5월 18일";
  const campaignBar = (
    <CampaignBar
      exampleMode={exampleMode}
      launched={launched}
      headline={headline}
      objective={objective}
      periodLabel={periodLabel}
      isFetching={q.isFetching}
      onRefetch={() => q.refetch()}
    />
  );

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <Button variant="ghost" onClick={onRestart}><Icon name="arrow-left" size={14} /> 처음으로 돌아가기</Button>
      <div className="inline-flex gap-2">
        {launched && (
          <Button variant="secondary" onClick={() => router.push(`/campaigns/${launched.campaignId}`)}>
            <Icon name="message" size={14} /> 캠페인 페이지에서 보기
          </Button>
        )}
        <Button variant="primary" onClick={onRestart}><Icon name="sparkles" size={14} /> 새 소재로 다시 만들기</Button>
      </div>
    </div>
  );

  // ── Real campaign: loading / error / no-data branches ──
  if (launched) {
    if (q.isLoading) {
      return (
        <>
          {campaignBar}
          <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
            <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
            <span className="font-medium text-[13px] leading-none">성과를 불러오는 중…</span>
          </Card>
          {footer}
        </>
      );
    }
    if (q.isError || !q.data) {
      return (
        <>
          {campaignBar}
          <Card className="border-[var(--w-status-negative)] flex flex-col items-center gap-3 py-8 px-5 text-center">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,66,66,0.10)] text-[var(--w-status-negative)] grid place-items-center"><Icon name="x" size={20} /></div>
            <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">성과를 불러오지 못했어요</div>
            <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">{q.error instanceof Error ? q.error.message : "알 수 없는 오류"}</p>
            <Button variant="primary" size="sm" onClick={() => q.refetch()}>다시 시도</Button>
          </Card>
          {footer}
        </>
      );
    }
    if (q.data.daily.length === 0) {
      return (
        <>
          {campaignBar}
          <Card className="flex flex-col items-center gap-3 py-8 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] grid place-items-center"><Icon name="clock" size={22} /></div>
            <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]">아직 성과 데이터가 없어요</div>
            <p className="font-medium text-[13px] leading-[1.7] text-[var(--w-fg-neutral)] m-0 max-w-[420px]">
              Meta가 광고를 검토하고 집계를 준비하고 있어요. 심사를 통과해 게재가 시작되고 노출이 쌓이면 여기에 표시돼요.<br />
              <span className="text-[var(--w-fg-alternative)]">보통 수 분 ~ 수 시간 걸리고, 데이터는 몇 시간 단위로 갱신돼요.</span>
            </p>
            <Button variant="primary" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? "확인 중…" : "성과 새로고침"}</Button>
          </Card>
          {footer}
        </>
      );
    }
  }

  // ── Data view (real data or example scenario) ──
  const data: Insights = exampleMode ? SCENARIOS[scenario] : (q.data as Insights);
  const labels = data.daily.map((x) => shortDate(x.date));
  const clicks = data.daily.map((x) => x.clicks);
  const ctrs = data.daily.map((x) => x.ctr);
  const dailyBudget = launched?.dailyBudget ?? 50000;
  const isPaused = !!launched && launched.status === "PAUSED";

  const ins = {
    impressions: data.impressions, clicks: data.clicks, ctr: data.ctr, spend: data.spend,
    reach: data.reach, frequency: data.frequency, cpm: data.cpm,
    postEngagement: data.postEngagement, postReaction: data.postReaction, postComment: data.postComment, postShare: data.postShare,
  };
  const suggestions = suggestOptimizations(ins, dailyBudget, objective, goalId);
  const readiness = assessAutomationReadiness(ins, data.daily.length, objective, goalId);

  const notifiedOptRef = useRef(false);
  useEffect(() => {
    if (!launched || exampleMode || notifiedOptRef.current || suggestions.length === 0) return;
    notifiedOptRef.current = true;
    addNotification({ type: "opt", message: `AI 최적화 제안이 ${suggestions.length}개 있어요. 성과 탭에서 확인해보세요.` });
  }, [launched, exampleMode, suggestions.length]);

  // 예시 모드 A/B 결과 카드 — 사용자가 STEP 02 에서 입력한 A/B 정보 + 시나리오별 가상 광고별 KPI 시드.
  // launched 가 없거나 launched.adIds 가 비어있을 때 (실광고 미게재) 사용자가 미리 결과 카드를 둘러볼 수 있게.
  const exampleAbInputs = useMemo<null | { variantA: string; variantB: string; ads: [AdInsightsRow, AdInsightsRow] }>(() => {
    const variantB = launchState.abTestVariantB;
    if (!launchState.abTestEnabled || variantB?.axis !== "headline") return null;
    if (launched?.adIds) return null; // 실광고 카드가 이미 mount
    const variantA = creativeState.headline;
    if (!variantA || variantA === variantB.headline) return null;
    const goodAds: [AdInsightsRow, AdInsightsRow] = [
      { adId: "example_a", impressions: 20000, clicks: 200, ctr: 1.0, spend: 50000 },
      { adId: "example_b", impressions: 20000, clicks: 300, ctr: 1.5, spend: 50000 },
    ];
    const poorAds: [AdInsightsRow, AdInsightsRow] = [
      { adId: "example_a", impressions: 400, clicks: 2, ctr: 0.5, spend: 8000 },
      { adId: "example_b", impressions: 500, clicks: 3, ctr: 0.6, spend: 8500 },
    ];
    return { variantA, variantB: variantB.headline, ads: scenario === "good" ? goodAds : poorAds };
  }, [launchState.abTestEnabled, launchState.abTestVariantB, creativeState.headline, launched?.adIds, scenario]);

  return (
    <>
      {campaignBar}

      {exampleMode && <ExampleBanner scenario={scenario} setScenario={setScenario} />}

      {/* PRD-ab-testing.md §5.1 — A/B 시험 결과 카드. adIds + axis + variantA + variantB + ads 다 있을 때만. */}
      {launched && launched.adIds && launched.abTestAxis && launched.abTestVariantA && launched.abTestVariantB && insightsWithAds?.ads && (
        <AbTestResultCard
          axis={launched.abTestAxis}
          variantA={launched.abTestVariantA}
          variantB={abVariantLabel(launched.abTestVariantB)}
          verdict={judgeAbTest(rowToKpi(insightsWithAds.ads[0]), rowToKpi(insightsWithAds.ads[1]))}
          onCreateWithWinner={() => router.push(`/create?prefill=campaign:${launched.campaignId}`)}
          demoMode={process.env.NEXT_PUBLIC_META_APP_MODE === "development"}
        />
      )}

      {/* 예시 모드 — launched 없을 때 STEP 02 에서 켠 A/B 시험을 시나리오별 가상 KPI 로 미리보기. */}
      {exampleAbInputs && (
        <AbTestResultCard
          axis="headline"
          variantA={exampleAbInputs.variantA}
          variantB={exampleAbInputs.variantB}
          verdict={judgeAbTest(rowToKpi(exampleAbInputs.ads[0]), rowToKpi(exampleAbInputs.ads[1]))}
          demoMode
        />
      )}

      <KpiGrid goalId={goalId} objective={objective} data={data} exampleMode={exampleMode} scenario={scenario} clicks={clicks} ctrs={ctrs} />

      <OptimizationPanel
        isPaused={isPaused}
        suggestions={suggestions}
        readiness={readiness}
        dailyBudget={dailyBudget}
        exampleMode={exampleMode}
        busy={control.isPending}
        onPause={() => applyControl({ action: "pause" }, "광고를 일시정지했어요")}
        onResume={() => applyControl({ action: "resume" }, "광고를 다시 게재했어요")}
        onIncreaseBudget={(to) => applyControl({ action: "set-daily-budget", dailyBudget: to }, `일일예산을 ${to}원으로 올렸어요`)}
        onRestart={onRestart}
      />

      <DailyTrend data={data} labels={labels} clicks={clicks} ctrs={ctrs} exampleMode={exampleMode} />

      {footer}
    </>
  );
}
