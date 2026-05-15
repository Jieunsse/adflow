"use client";

// STEP 03 성과 확인 widget — ADR-001 §deepening ③.
// useCreative legacy shim 대신 useLaunchDraft + useCreativeDraft 직접 구독.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";
import { useToast } from "@shared/ui/Toast";
import { suggestOptimizations, assessAutomationReadiness } from "@entities/insights/optimization";
import { addNotification } from "@shared/lib/notifications";
import { shortDate } from "@shared/lib/format";

import CampaignBar from "./CampaignBar";
import ExampleBanner from "./ExampleBanner";
import KpiGrid from "./KpiGrid";
import OptimizationPanel from "./OptimizationPanel";
import DailyTrend from "./DailyTrend";
import type { Insights, CampaignObjective } from "./_types";

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

  const q = useQuery<Insights>({
    queryKey: ["insights", launched?.campaignId, objective],
    enabled: !!launched,
    queryFn: async () => {
      const url = `/api/insights/${launched!.campaignId}?objective=${objective}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "성과를 불러오지 못했어요");
      return data as Insights;
    },
  });

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
    <div className="between">
      <button className="btn btn--ghost" type="button" onClick={onRestart}><Icon name="arrow-left" size={14} /> 처음으로 돌아가기</button>
      <div style={{ display: "inline-flex", gap: 8 }}>
        {launched && (
          <button className="btn btn--secondary" type="button" onClick={() => router.push(`/campaigns/${launched.campaignId}`)}>
            <Icon name="message" size={14} /> 캠페인 페이지에서 보기
          </button>
        )}
        <button className="btn btn--primary" type="button" onClick={onRestart}><Icon name="sparkles" size={14} /> 새 소재로 다시 만들기</button>
      </div>
    </div>
  );

  // ── Real campaign: loading / error / no-data branches ──
  if (launched) {
    if (q.isLoading) {
      return (
        <>
          {campaignBar}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", color: "var(--w-fg-neutral)" }}>
            <div className="spinner" />
            <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>성과를 불러오는 중…</span>
          </div>
          {footer}
        </>
      );
    }
    if (q.isError || !q.data) {
      return (
        <>
          {campaignBar}
          <div className="card" style={{ borderColor: "var(--w-status-negative)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px", textAlign: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name="x" size={20} /></div>
            <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>성과를 불러오지 못했어요</div>
            <p style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: 0 }}>{q.error instanceof Error ? q.error.message : "알 수 없는 오류"}</p>
            <button className="btn btn--primary btn--sm" type="button" onClick={() => q.refetch()}>다시 시도</button>
          </div>
          {footer}
        </>
      );
    }
    if (q.data.daily.length === 0) {
      return (
        <>
          {campaignBar}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }}><Icon name="clock" size={22} /></div>
            <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>아직 성과 데이터가 없어요</div>
            <p style={{ font: "500 13px/1.7 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: 0, maxWidth: 420 }}>
              Meta가 광고를 검토하고 집계를 준비하고 있어요. 심사를 통과해 게재가 시작되고 노출이 쌓이면 여기에 표시돼요.<br />
              <span style={{ color: "var(--w-fg-alternative)" }}>보통 수 분 ~ 수 시간 걸리고, 데이터는 몇 시간 단위로 갱신돼요.</span>
            </p>
            <button className="btn btn--primary btn--sm" type="button" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? "확인 중…" : "성과 새로고침"}</button>
          </div>
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
  const suggestions = suggestOptimizations(ins, dailyBudget, objective);
  const readiness = assessAutomationReadiness(ins, data.daily.length, objective);

  const notifiedOptRef = useRef(false);
  useEffect(() => {
    if (!launched || exampleMode || notifiedOptRef.current || suggestions.length === 0) return;
    notifiedOptRef.current = true;
    addNotification({ type: "opt", message: `AI 최적화 제안이 ${suggestions.length}개 있어요. 성과 탭에서 확인해보세요.` });
  }, [launched, exampleMode, suggestions.length]);

  return (
    <>
      {campaignBar}

      {exampleMode && <ExampleBanner scenario={scenario} setScenario={setScenario} />}

      <KpiGrid objective={objective} data={data} exampleMode={exampleMode} scenario={scenario} clicks={clicks} ctrs={ctrs} />

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
