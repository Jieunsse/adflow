"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Icon, { type IconName } from "@shared/ui/Icon";
import DatePicker from "@shared/ui/DatePicker";
import AgeRange from "@shared/ui/AgeRange";
import { COUNTRIES } from "@shared/lib/geo-options";
import { KpiCard } from "@shared/ui/primitives";
import DualChart, { ChartLegend } from "@shared/ui/DualChart";
import { fmt, fmtKRW, shortDate, campaignDateInfo, campaignRunDays, campaignGradient } from "@shared/lib/format";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useToast } from "@shared/ui/Toast";
import ConfirmModal from "@shared/ui/ConfirmModal";
import { suggestOptimizations, assessAutomationReadiness, type Suggestion, type AutomationReadiness } from "@entities/insights/optimization";
import { isFakePerformance, type FakePerformanceEvidence } from "@entities/insights/fake-performance";
import { abVariantLabel, type AbTestAxis } from "@entities/campaign/model";
import { loadLaunchedCampaign } from "@entities/campaign/launched-storage";
import { getBrowse, upsertBrowse, BROWSE_CHANGE_EVENT } from "@entities/campaign/browse/store";
import { createBrowseRelaunchChild } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import { buildBrowseInsights, type BrowseQuality } from "@entities/campaign/browse/insights";
import type { BrowseCampaign, AutomationPolicy, AutoPilotAction } from "@entities/campaign/browse/types";
import PresenterFastForwardBar from "@widgets/presenter-fast-forward";
import { judgeAbTest, rowToKpi } from "@entities/insights/ab-verdict";
import { getMockCampaignAdIds, seedMockAdRows } from "@/lib/mock-campaigns";
import AbTestResultCard from "@widgets/performance-step/AbTestResultCard";
import type { CampaignSummary, InsightsPeriod } from "@/lib/meta-ads";
import type { AdInsightsRow } from "@entities/insights/types";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { SegControl } from "@shared/ui/SegControl";
import { cn } from "@shared/lib/cn";
import { useAutoRelaunch } from "@shared/lib/autoRelaunch";
import { useNotifications, type WinnerEvidence } from "@shared/lib/notifications";


type Period = "all" | InsightsPeriod;
// PRD-ab-testing.md §7.2 — Insights 응답에 광고별 row 추가 가능.
type Insights = {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  daily: { date: string; clicks: number; ctr: number; spend: number }[];
  ads?: [AdInsightsRow, AdInsightsRow];
};
type ControlParams = { campaignId: string; adSetId?: string; adId?: string; action: "pause" | "resume" | "set-daily-budget"; dailyBudget?: number };
type ControlResult = { ok: true };

// PRD-ab-testing.md §5 — 두 화면 공유 AbTestResultCard 의 입력. 사용자 생성(launched) vs mock 시연 두 경로에서 도출.
type AbInfo = {
  adIds: [string, string];
  axis: AbTestAxis;
  variantA: string;
  variantB: string;
  startDate: string;
};

// ADR-034 — DetailBody 에 주입하는 Auto-Pilot 상태 묶음. Browse Mode 에서만 전달(실제 경로는 undefined → 버튼 disabled 유지).
type AutoPilotUi = {
  on: boolean;
  actions: AutoPilotAction[];
  onRequestEnable: () => void;
  onDisable: () => void;
};

const STATUS_CHIP: Record<string, { label: string; chip: string }> = {
  live: { label: "게재 중", chip: "live" }, review: { label: "검토 중", chip: "review" },
  paused: { label: "일시정지", chip: "paused" }, ended: { label: "종료", chip: "ended" }, issue: { label: "이슈", chip: "issue" },
};

async function fetchJson<T>(url: string, notFoundIs401Msg = "광고 계정을 먼저 연결해주세요."): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (res.status === 401) throw Object.assign(new Error(data?.error ?? notFoundIs401Msg), { code: 401 });
  if (!res.ok) throw new Error(data?.error ?? "불러오지 못했어요");
  return data as T;
}

function CampaignDetailFlow() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const showToast = useToast();

  const initialPeriod = (searchParams.get("period") ?? "all") as Period;
  const [period, setPeriod] = useState<Period>(initialPeriod === "7d" || initialPeriod === "30d" ? initialPeriod : "all");
  const rawTab = searchParams.get("tab");
  const initialTab = rawTab === "performance" ? "performance" : "info";
  const [activeTab, setActiveTab] = useState<"info" | "performance">(initialTab);

  // ADR-033 — Browse Mode 성과 탭: 기간 토글 대신 좋은/나쁜 성과 예시 토글.
  const [quality, setQuality] = useState<BrowseQuality>("good");

  const [showRelaunchModal, setShowRelaunchModal] = useState(false);
  const [relaunchOnlyOnce, setRelaunchOnlyOnce] = useState(false);
  const [relaunchBusy, setRelaunchBusy] = useState(false);
  const [relaunchError, setRelaunchError] = useState<string | null>(null);
  const { get: getAutoRelaunch, setEnabled: setAutoRelaunch, inheritFromParent } = useAutoRelaunch();
  const { notifs } = useNotifications();

  // ADR-034 — Auto-Pilot(AI 자동 운영). Browse Mode 한정. 확인 모달에서 부진 대응 정책 선택 후 켬.
  const [showAutoPilotModal, setShowAutoPilotModal] = useState(false);
  const [autoPilotPolicy, setAutoPilotPolicy] = useState<AutomationPolicy>("decrease");

  useEffect(() => {
    if (searchParams.get("relaunch") === "1") {
      setShowRelaunchModal(true);
    }
  }, [searchParams]);

  const autoRelaunchEntry = getAutoRelaunch(id);
  const relaunchEvidence = useMemo<WinnerEvidence | null>(() => {
    const n = notifs.find((n) => n.type === "auto-relaunch-ready" && n.campaignId === id);
    return n?.evidence ?? null;
  }, [notifs, id]);

  const handleRelaunch = async () => {
    setRelaunchError(null);
    // ADR-033 — Browse Mode: 서버 /api/campaign/relaunch 대신 localStorage 레이어에 자식 생성.
    if (browseCamp) {
      const childId = createBrowseRelaunchChild(browseCamp.id);
      if (!childId) { setRelaunchError("재게재에 실패했어요"); return; }
      inheritFromParent(id, childId, !relaunchOnlyOnce);
      setShowRelaunchModal(false);
      const base = browseCamp.name.replace(/ \(자동 재게재 #\d+\)$/, "");
      showToast(`'${base} (자동 재게재 #${browseCamp.cycle + 1})' 게재됐어요`);
      router.push(`/campaigns/${childId}`);
      return;
    }
    setRelaunchBusy(true);
    try {
      const cycleCount = (autoRelaunchEntry?.cycleCount ?? 1) + 1;
      const res = await fetch("/api/campaign/relaunch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id, cycleCount }),
      });
      const data = await res.json() as { campaignId?: string; newName?: string; error?: string };
      if (!res.ok) {
        setRelaunchError(data.error ?? "재게재에 실패했어요");
        return;
      }
      const newId = data.campaignId!;
      inheritFromParent(id, newId, !relaunchOnlyOnce);
      setShowRelaunchModal(false);
      showToast(`'${data.newName ?? "새 캠페인"}' 게재됐어요`);
      router.push(`/campaigns/${newId}`);
    } catch {
      setRelaunchError("재게재에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setRelaunchBusy(false);
    }
  };

  // PRD-ab-testing.md §5.1 — 사용자 생성 캠페인은 adflow:launched:{id} 에서 A/B 정보. 1회 load (SSR-safe).
  const [launchedSnapshot] = useState(() => (typeof window !== "undefined" ? loadLaunchedCampaign(id) : null));

  // ADR-033 — Browse Mode 시연 캠페인이면 API 대신 localStorage 레이어 + buildBrowseInsights 를 소스로.
  // fastForwardDays 가 바뀌면(빨리감기 바) BROWSE_CHANGE_EVENT 로 재읽기.
  const [browseCamp, setBrowseCamp] = useState<BrowseCampaign | null>(() => (typeof window !== "undefined" ? getBrowse(id) : null));
  useEffect(() => {
    const reload = () => setBrowseCamp(getBrowse(id));
    window.addEventListener(BROWSE_CHANGE_EVENT, reload);
    return () => window.removeEventListener(BROWSE_CHANGE_EVENT, reload);
  }, [id]);

  const metaQ = useQuery({ queryKey: ["campaign-meta", id], queryFn: () => fetchJson<{ campaign: CampaignSummary }>(`/api/campaign/${id}`).then((d) => d.campaign), enabled: !browseCamp });

  const browseSummary = useMemo(() => (browseCamp ? browseCampaignToSummary(browseCamp) : null), [browseCamp]);
  const c = browseSummary ?? metaQ.data;
  const metaUnauthorized = !browseCamp && (metaQ.error as { code?: number } | null)?.code === 401;

  // launched-storage(사용자 생성) → mock 시연 entry 순으로 A/B 정보 도출.
  const abInfo = useMemo<AbInfo | null>(() => {
    if (launchedSnapshot?.adIds && launchedSnapshot.abTestAxis && launchedSnapshot.abTestVariantA && launchedSnapshot.abTestVariantB && launchedSnapshot.startDate) {
      return {
        adIds: launchedSnapshot.adIds,
        axis: launchedSnapshot.abTestAxis,
        variantA: launchedSnapshot.abTestVariantA,
        variantB: abVariantLabel(launchedSnapshot.abTestVariantB),
        startDate: launchedSnapshot.startDate,
      };
    }
    if (c?.abTestEnabled && c.abTestAxis && c.abTestVariantA && c.abTestVariantB && c.startDate) {
      const mockAdIds = getMockCampaignAdIds(id);
      if (!mockAdIds) return null;
      return { adIds: mockAdIds, axis: c.abTestAxis, variantA: c.abTestVariantA, variantB: c.abTestVariantB, startDate: c.startDate };
    }
    return null;
  }, [launchedSnapshot, c, id]);

  const adIdsParam = abInfo ? `&adIds=${abInfo.adIds[0]},${abInfo.adIds[1]}` : "";
  const insQ = useQuery({ queryKey: ["insights", id, period, abInfo?.adIds?.join(",")], queryFn: () => fetchJson<Insights>(`/api/insights/${id}?period=${period}${adIdsParam}`), enabled: !browseCamp });
  const control = useApiMutation<ControlParams, ControlResult>("/api/campaign/control");

  // ADR-033 — Browse Mode: 성과는 buildBrowseInsights(fastForwardDays) 로, 로딩·에러는 API 대신 즉시 해소.
  const insData = browseCamp ? (buildBrowseInsights(browseCamp, quality) as Insights) : insQ.data;
  const insLoading = browseCamp ? false : insQ.isLoading;
  const insError = browseCamp ? false : insQ.isError;
  const metaLoading = browseCamp ? false : metaQ.isLoading;

  // PRD-ab-testing.md §7.5 — fake adIds 면 server 가 ads 비움. client 가 startDate 로 합성.
  const insightsWithAds = useMemo<Insights | undefined>(() => {
    if (!insData || !abInfo) return insData;
    if (insData.ads) return insData;
    const ads = seedMockAdRows(id, abInfo.startDate, abInfo.adIds);
    return { ...insData, ads };
  }, [insData, abInfo, id]);

  const applyControl = (p: Omit<ControlParams, "campaignId">, msg: string) => {
    control.mutate({ campaignId: id, ...p }, {
      onSuccess: () => { showToast(msg); metaQ.refetch(); insQ.refetch(); },
      onError: (e) => showToast(e instanceof Error ? e.message : "적용에 실패했어요"),
    });
  };

  const enableAutoPilot = () => {
    if (!browseCamp) return;
    upsertBrowse({ ...browseCamp, automationOn: true, automationPolicy: autoPilotPolicy });
    setShowAutoPilotModal(false);
    showToast("AI 자동 운영을 켰어요 — 빨리감기로 AI가 조치하는 걸 확인해보세요");
  };
  const disableAutoPilot = () => {
    if (!browseCamp) return;
    upsertBrowse({ ...browseCamp, automationOn: false });
    showToast("AI 자동 운영을 껐어요");
  };
  const autoPilotUi: AutoPilotUi | undefined = browseCamp
    ? { on: !!browseCamp.automationOn, actions: browseCamp.autoActions ?? [], onRequestEnable: () => setShowAutoPilotModal(true), onDisable: disableAutoPilot }
    : undefined;

  const { daysLine, progressLine } = campaignDateInfo(c?.startDate ?? null, c?.endDate ?? null, c?.status ?? "");
  const adsManagerUrl = session?.adAccountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${session.adAccountId.replace(/^act_/, "")}&selected_campaign_ids=${id}`
    : "https://adsmanager.facebook.com/";

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="캠페인 상세">
      {showRelaunchModal && (
        <RelaunchConfirmModal
          campaignName={c?.headline ?? c?.name ?? "캠페인"}
          evidence={relaunchEvidence}
          cycleCount={autoRelaunchEntry?.cycleCount ?? 1}
          onlyOnce={relaunchOnlyOnce}
          onOnlyOnceChange={setRelaunchOnlyOnce}
          busy={relaunchBusy}
          error={relaunchError}
          onRelaunch={handleRelaunch}
          onEditOriginal={() => { setShowRelaunchModal(false); router.push(`/create?prefill=campaign:${id}`); }}
          onClose={() => { setShowRelaunchModal(false); setRelaunchError(null); const u = new URL(window.location.href); u.searchParams.delete("relaunch"); window.history.replaceState(null, "", u.toString()); }}
        />
      )}
      {showAutoPilotModal && (
        <AutoPilotConfirmModal
          policy={autoPilotPolicy}
          onPolicyChange={setAutoPilotPolicy}
          onConfirm={enableAutoPilot}
          onClose={() => setShowAutoPilotModal(false)}
        />
      )}
      <button type="button" onClick={() => router.push("/campaigns")} className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-current hover:underline" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--w-fg-neutral)", marginBottom: 4 }}>
        <Icon name="arrow-left" size={13} /> 캠페인
      </button>

      <div className="flex justify-between items-end gap-6" style={{ marginTop: 4 }}>
        <div>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 0 }}>{c?.headline ?? "캠페인"}</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">{c?.name ?? id}</p>
        </div>
      </div>

      <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px] mb-4">
        <button type="button" className={cn("border-none px-3.5 py-2 rounded-lg font-semibold text-[12.5px] leading-none cursor-pointer transition-[background,color] duration-[120ms]", activeTab === "info" ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]" : "bg-transparent text-[var(--w-fg-neutral)]")} onClick={() => setActiveTab("info")}>캠페인 정보</button>
        <button type="button" className={cn("border-none px-3.5 py-2 rounded-lg font-semibold text-[12.5px] leading-none cursor-pointer transition-[background,color] duration-[120ms]", activeTab === "performance" ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]" : "bg-transparent text-[var(--w-fg-neutral)]")} onClick={() => setActiveTab("performance")}>성과</button>
      </div>

      {metaUnauthorized ? (
        <DetailErrorCard icon="link" title="광고 계정을 먼저 연결해주세요" reason="Meta 광고 계정과 페이지를 연결해야 캠페인을 볼 수 있어요." ctaLabel="계정 연결로 가기" onAction={() => router.push("/setup")} />
      ) : !browseCamp && metaQ.isError ? (
        <DetailErrorCard title="캠페인 정보를 불러오지 못했어요" reason={metaQ.error instanceof Error ? metaQ.error.message : "잠시 후 다시 시도해 주세요"} ctaLabel="다시 시도" onAction={() => metaQ.refetch()} />
      ) : activeTab === "info" ? (
        <CampaignConfigurationTab c={c} isLoading={metaLoading} campaignId={id} onRefetch={metaQ.refetch} isAbCampaign={abInfo !== null} />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 360px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: campaignGradient(id), flex: "0 0 auto" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  {c ? (
                    <Chip variant={(STATUS_CHIP[c.status]?.chip ?? "neutral") as ChipVariant} dot>{STATUS_CHIP[c.status]?.label ?? c.status}</Chip>
                  ) : (
                    <Skeleton className="h-[22px] w-[70px] rounded-full" />
                  )}
                  <Chip variant="neutral" className="font-medium text-[11.5px] leading-none [font-family:var(--w-font-mono)]">Campaign ID · {id.slice(-10)}</Chip>
                </div>
                <div className="font-medium text-[12.5px] leading-none text-[var(--w-fg-neutral)]">{daysLine} · {progressLine}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {!abInfo && (
                <Button variant="secondary" type="button" onClick={() => router.push(`/ab-tests/new?from=${id}`)}>
                  <Icon name="chart" size={14} /> 이 캠페인으로 A/B 테스트 생성
                </Button>
              )}
              {browseCamp ? (
                <SegControl
                  value={quality}
                  onChange={setQuality}
                  options={[{ value: "good", label: "성과 좋음" }, { value: "bad", label: "성과 나쁨" }]}
                />
              ) : (
                <SegControl
                  value={period}
                  onChange={setPeriod}
                  options={[{ value: "all", label: "전체" }, { value: "7d", label: "최근 7일" }, { value: "30d", label: "최근 30일" }]}
                />
              )}
            </div>
          </Card>

          {metaLoading || insLoading ? (
            <Card className="flex flex-col items-center gap-3 py-10 px-8">
              <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-7 h-7" />
              <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">성과를 불러오는 중…</div>
            </Card>
          ) : insError ? (
            <DetailErrorCard title="성과를 불러오지 못했어요" reason={insQ.error instanceof Error ? insQ.error.message : "Meta API 응답 오류 — 잠시 후 다시 시도해 주세요"} ctaLabel="다시 시도" onAction={() => insQ.refetch()} />
          ) : !c ? null : c.status === "review" || !insData || insData.daily.length === 0 ? (
            <Card className="py-10 px-8 flex flex-col items-center gap-3 text-center">
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }}><Icon name="clock" size={24} /></div>
              <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]">아직 성과 데이터가 없어요</div>
              <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ maxWidth: 400, lineHeight: 1.7 }}>
                Meta가 광고를 검토·집계 준비 중이에요. 심사를 통과해 게재가 시작되고 노출이 쌓이면 여기에 표시돼요.<br />
                <span style={{ color: "var(--w-fg-alternative)" }}>보통 수 분 ~ 수 시간 걸리고, 데이터는 몇 시간 단위로 갱신돼요.</span>
              </div>
            </Card>
          ) : (
            <>
              {/* PRD-ab-testing.md §5.1 — KpiCard 행 위에 결과 카드. */}
              {abInfo && insightsWithAds?.ads && (
                <AbTestResultCard
                  axis={abInfo.axis}
                  variantA={abInfo.variantA}
                  variantB={abInfo.variantB}
                  verdict={judgeAbTest(rowToKpi(insightsWithAds.ads[0]), rowToKpi(insightsWithAds.ads[1]))}
                  onCreateWithWinner={() => router.push(`/create?prefill=campaign:${id}`)}
                  demoMode={process.env.NEXT_PUBLIC_META_APP_MODE === "development"}
                />
              )}
              <DetailBody c={c} data={insData} period={period} busy={control.isPending} adsManagerUrl={adsManagerUrl} onApply={applyControl} onRemake={() => router.push("/create")} autoPilot={autoPilotUi} lowPerformance={!!browseCamp && quality === "bad"} />
            </>
          )}
        </>
      )}

      {browseCamp && <PresenterFastForwardBar camp={browseCamp} />}
    </div>
  );
}

function DetailBody({
  c, data, busy, adsManagerUrl, onApply, onRemake, autoPilot, lowPerformance,
}: {
  c: CampaignSummary; data: Insights; period: Period; busy: boolean; adsManagerUrl: string;
  onApply: (p: Omit<ControlParams, "campaignId">, msg: string) => void; onRemake: () => void;
  autoPilot?: AutoPilotUi; lowPerformance?: boolean;
}) {
  const labels = data.daily.map((x) => shortDate(x.date));
  const clicks = data.daily.map((x) => x.clicks);
  const ctrs = data.daily.map((x) => x.ctr);
  const dailyBudget = c.dailyBudget ?? 50000;
  const isPaused = c.status === "paused";
  const isIssue = c.status === "issue";
  const metrics = { impressions: data.impressions, clicks: data.clicks, ctr: data.ctr, spend: data.spend };
  const baseSuggestions = suggestOptimizations(metrics, dailyBudget, data.daily.length);
  // ADR-030 — 가짜 성과 의심은 CampaignSummary(actions[]) 기준. 감지 시 모순되는 예산 증액 제안은 숨기고 점검 카드를 앞세움.
  const fakePerf = isFakePerformance(
    { impressions: c.impressions, ctr: c.ctr, linkClick: c.linkClick ?? 0, landingPageView: c.landingPageView },
    campaignRunDays(c.startDate, c.endDate),
  );
  const suggestions: Suggestion[] = fakePerf.fake && fakePerf.evidence
    ? [fakePerfSuggestion(fakePerf.evidence), ...baseSuggestions.filter((s) => s.kind !== "increase-budget")]
    : baseSuggestions;
  // Browse Mode 성과 나쁨 탭 — 지표 자체가 부진하므로 데이터 충분성과 무관하게 자동화 보류로 고정.
  const readiness = lowPerformance
    ? { ready: false as const, reason: `노출 ${data.impressions.toLocaleString("ko-KR")}회 · 클릭 ${data.clicks.toLocaleString("ko-KR")}회 · CTR ${data.ctr.toFixed(2)}% — 클릭과 CTR이 낮아 자동 판단을 맡기기엔 성과가 아쉬워요.` }
    : assessAutomationReadiness(metrics, data.daily.length);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <KpiCard label="총 노출수" value={fmt(data.impressions)} trend={[120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285]} />
        <KpiCard label="총 클릭수" value={fmt(data.clicks)} trend={clicks} />
        <KpiCard label="CTR" value={data.ctr.toFixed(2)} suffix="%" trend={ctrs} />
        <KpiCard label="총 지출" value={fmtKRW(data.spend)} trend={data.daily.map((x) => x.spend / 1000)} color="var(--w-accent-violet)" />
      </div>

      {isPaused ? (
        <Card style={{ background: "rgba(255,146,0,0.06)", border: "1px solid rgba(255,146,0,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,146,0,0.15)", color: "var(--w-status-cautionary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="pause" size={20} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]">이 광고는 일시정지 상태예요</div>
              <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 4 }}>재개하거나 새 소재로 다시 만들어볼 수 있어요. Meta 광고 관리자에서 외부로 상태가 바뀌었다면 새로고침 후 다시 확인해주세요.</div>
            </div>
            <div style={{ display: "inline-flex", gap: 8 }}>
              <Button variant="secondary" type="button" disabled={busy || !c.adSetId} onClick={() => onApply({ adSetId: c.adSetId ?? undefined, adId: c.adId ?? undefined, action: "resume" }, "광고를 재개했어요")}><Icon name="play" size={14} /> {busy ? "처리 중…" : "광고 재개"}</Button>
              <Button variant="primary" type="button" onClick={onRemake}><Icon name="sparkles" size={14} /> 새 소재로 다시 만들기</Button>
            </div>
          </div>
        </Card>
      ) : isIssue ? (
        <Card style={{ background: "rgba(255,66,66,0.06)", border: "1px solid rgba(255,66,66,0.30)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,66,66,0.12)", color: "var(--w-status-negative)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="warn" size={20} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]">이 광고에 문제가 있어요</div>
              <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 4 }}>Meta 광고 관리자에서 사유를 확인하고 조치해 주세요.</div>
            </div>
            <a className={buttonVariants({ variant: "secondary" })} href={adsManagerUrl} target="_blank" rel="noreferrer">Meta 광고 관리자에서 사유 확인 <Icon name="arrow-right" size={14} /></a>
          </div>
        </Card>
      ) : (
        <Card style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "flex-start" }}>
          <div>
            <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0">최적화 제안</h3>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">제안은 직접 확인 후 적용해요. 자동으로 바뀌지 않아요.</p>
            <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {suggestions.length === 0 ? (
                <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]">지금은 특별히 권할 조정이 없어요. 데이터가 더 쌓이면 다시 살펴볼게요.</p>
              ) : suggestions.map((s, i) => {
                const warn = s.severity === "warn";
                return (
                  <OptCard key={i} icon={warn ? "warn" : "trend-up"} good={!warn} title={s.title} lines={s.detail}>
                    {autoPilot?.on
                      ? (s.kind === "pause" || s.kind === "increase-budget") && <AutoAppliedTag />
                      : <>
                          {s.kind === "pause" && <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={() => onApply({ action: "pause" }, "광고를 일시정지했어요")}>{busy ? "처리 중…" : "광고 일시정지"}</Button>}
                          {s.kind === "increase-budget" && <Button variant="secondary" size="sm" type="button" disabled={busy || !c.adSetId} onClick={() => onApply({ adSetId: c.adSetId ?? undefined, action: "set-daily-budget", dailyBudget: s.toDailyBudget }, `일일예산을 ${fmtKRW(s.toDailyBudget)}로 올렸어요`)}>{busy ? "처리 중…" : `${fmtKRW(s.toDailyBudget)}로 올리기`}</Button>}
                        </>}
                  </OptCard>
                );
              })}
            </div>
            <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]" style={{ marginTop: 12 }}>현재 일일예산은 {fmtKRW(dailyBudget)} 이에요.</div>
          </div>
          <div>
            <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0">자동화 준비도</h3>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">충분한 데이터가 쌓이면 AI가 자동으로 광고를 운영할 수 있어요.</p>
            <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
            <AutomationReadinessCard readiness={readiness} autoPilot={autoPilot} lowPerformance={lowPerformance} />
          </div>
        </Card>
      )}

      <Card style={{ marginTop: 16 }}>
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
          <div>
            <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0">일별 추이</h3>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">최근 {data.daily.length}일 클릭수와 CTR 변화</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <ChartLegend color="var(--w-primary-normal)" label="클릭수" type="bar" />
            <ChartLegend color="var(--w-accent-violet)" label="CTR" type="line" />
          </div>
        </div>
        <DualChart labels={labels} clicks={clicks} ctrs={ctrs} />
      </Card>

      <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 16px" }}>
          <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0" style={{ marginBottom: 4 }}>일별 상세</h3>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1" style={{ marginBottom: 0 }}>날짜별 핵심 지표 · 전일 대비 CTR 변화 포함</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr><th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left">날짜</th><th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ textAlign: "right" }}>클릭</th><th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ textAlign: "right" }}>CTR</th><th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ textAlign: "right" }}>지출</th><th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 96, textAlign: "right" }}>전일 대비</th></tr>
          </thead>
          <tbody>
            {data.daily.map((row, i) => {
              const prev = data.daily[i - 1];
              const delta = prev ? row.ctr - prev.ctr : null;
              const up = delta != null && delta > 0;
              const flat = delta != null && Math.abs(delta) < 0.01;
              return (
                <tr key={i} className="group">
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">{shortDate(row.date)}</td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmt(row.clicks)}</td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{row.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmtKRW(row.spend)}</td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
                    {delta == null ? <span style={{ color: "var(--w-fg-alternative)" }}>—</span>
                      : flat ? <span style={{ color: "var(--w-fg-neutral)" }}>±0.00%p</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: up ? "var(--w-status-positive)" : "var(--w-status-negative)" }}><Icon name={up ? "trend-up" : "trend-down"} size={12} />{(up ? "+" : "")}{delta.toFixed(2)}%p</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "12px 22px 18px" }}><span className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]">Meta 인사이트 기준 · 데이터는 몇 시간 단위로 갱신돼요</span></div>
      </Card>
    </>
  );
}

// ADR-034 — 자동 운영 켜진 동안, 수동 적용 버튼 자리에 "AI가 자동 적용" 표식. 수동→자동 전환을 직접 대비.
function AutoAppliedTag() {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-[12px] leading-none" style={{ color: "var(--w-primary-press)", background: "var(--w-primary-soft)", borderRadius: 999, padding: "7px 12px", whiteSpace: "nowrap" }}>
      🤖 AI가 자동 적용
    </span>
  );
}

// ADR-034 — 자동화 준비도 카드. Browse(autoPilot 전달)면 켜기/운영중 로그/끄기, 실제 경로면 disabled 버튼 유지.
function AutomationReadinessCard({ readiness, autoPilot, lowPerformance }: { readiness: AutomationReadiness; autoPilot?: AutoPilotUi; lowPerformance?: boolean }) {
  const ACTION_ICON: Record<AutoPilotAction["kind"], IconName> = { "increase-budget": "trend-up", "decrease-budget": "trend-down", pause: "pause" };
  if (autoPilot?.on) {
    return (
      <div style={{ background: "rgba(0,191,64,0.06)", border: "1px solid rgba(0,191,64,0.20)", borderRadius: 12, padding: 18 }}>
        <Chip variant="live" dot>자동 운영 중</Chip>
        <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginTop: 10 }}>AI가 광고를 자동 운영하고 있어요</div>
        <p className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]" style={{ margin: "8px 0 12px" }}>성과를 지켜보다 예산·게재를 자동으로 조정해요. 모든 조치는 알림으로 알려드려요.</p>
        {autoPilot.actions.length === 0 ? (
          <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-alternative)]" style={{ marginBottom: 14 }}>아직 조치 내역이 없어요 — 빨리감기로 시간을 넘기면 AI가 판단해요.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "0 0 14px" }}>
            {autoPilot.actions.slice().reverse().map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                <Icon name={ACTION_ICON[a.kind]} size={13} />
                <span className="font-medium text-[12.5px] leading-[1.45] text-[var(--w-fg-neutral)]"><b className="text-[var(--w-fg-strong)]">{a.atDay}일차</b> · {a.detail}</span>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" type="button" onClick={autoPilot.onDisable}>자동 운영 끄기</Button>
      </div>
    );
  }
  if (readiness.ready) {
    return (
      <div style={{ background: "rgba(0,191,64,0.06)", border: "1px solid rgba(0,191,64,0.20)", borderRadius: 12, padding: 18 }}>
        <Chip variant="live" dot>자동화 준비 완료</Chip>
        <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginTop: 10 }}>AI 자동 운영을 켤 수 있어요</div>
        <p className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]" style={{ margin: "8px 0 14px" }}>{readiness.reason}</p>
        {autoPilot ? (
          <Button variant="primary" size="sm" type="button" onClick={autoPilot.onRequestEnable}>자동화 켜기</Button>
        ) : (
          <Button variant="primary" size="sm" type="button" disabled title="자동 실행 환경 연동 후 활성화돼요">자동화 켜기</Button>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: "var(--w-bg-alternative)", borderRadius: 12, padding: 18 }}>
      <Chip variant="neutral">{lowPerformance ? "지표 개선 먼저" : "아직 지표가 아쉬워요"}</Chip>
      <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginTop: 10 }}>자동화 하기엔 지표가 아쉬워요</div>
      <p className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]" style={{ margin: "8px 0" }}>{lowPerformance ? `${readiness.reason} 카피·타겟을 먼저 손보고 다시 살펴봐요.` : `부족: ${readiness.reason}. 데이터가 더 쌓이면 자동화를 제안해드릴게요.`}</p>
    </div>
  );
}

// ADR-034 — 자동 운영 확인 모달. 위임 범위를 명시하고 부진 대응 정책(감액/정지)을 라디오로 받음.
function AutoPilotConfirmModal({ policy, onPolicyChange, onConfirm, onClose }: {
  policy: AutomationPolicy; onPolicyChange: (p: AutomationPolicy) => void; onConfirm: () => void; onClose: () => void;
}) {
  const radio = (value: AutomationPolicy, title: string, desc: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${policy === value ? "var(--w-primary-normal)" : "var(--w-line-alternative)"}`, background: policy === value ? "var(--w-primary-soft)" : "transparent" }}>
      <input type="radio" name="autopilot-policy" checked={policy === value} onChange={() => onPolicyChange(value)} style={{ width: 15, height: 15, marginTop: 2 }} />
      <span>
        <span className="font-semibold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)] block">{title}</span>
        <span className="font-medium text-[12.5px] leading-[1.45] text-[var(--w-fg-neutral)] block" style={{ marginTop: 2 }}>{desc}</span>
      </span>
    </label>
  );
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--w-bg-elevated)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "28px 28px 24px", maxWidth: 500, width: "calc(100vw - 32px)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div className="font-bold text-[18px] leading-[1.25] tracking-[-0.016em] text-[var(--w-fg-strong)]">AI 자동 운영 켜기</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 6 }}>켜면 AI가 성과를 지켜보다 아래 조치를 직접 적용해요.</div>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--w-bg-alternative)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">📈 성과가 우수하면(목표 CTR 이상) 일일예산을 단계적으로 증액해요.</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">📉 성과가 목표에 못 미치면 아래에서 고른 방식으로 대응해요.</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">🔔 모든 조치는 알림으로 보고하고, 언제든 끌 수 있어요.</div>
        </div>
        <div>
          <div className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]" style={{ marginBottom: 10 }}>성과가 부진하면</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {radio("decrease", "예산 줄이기", "광고는 유지하면서 일일예산을 낮춰 지출을 아껴요.")}
            {radio("pause", "광고 멈추기", "광고를 정지해 지출을 즉시 막아요.")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
          <Button variant="primary" type="button" onClick={onConfirm}>자동 운영 켜기</Button>
        </div>
      </div>
    </div>
  );
}

// ADR-030 — 증거 + 점검 3갈래. "의심" 을 항상 포함하고 별도 액션 버튼은 두지 않음.
function fakePerfSuggestion(e: FakePerformanceEvidence): Suggestion {
  return {
    kind: "fake-performance",
    severity: "warn",
    title: "가짜 성과 의심 — 클릭은 많은데 도착이 적어요",
    detail: [
      `CTR ${e.ctr.toFixed(2)}%로 좋아 보이지만, 링크 클릭의 ${e.dropRate}%가 페이지 도착 전에 이탈했어요 (도착률 ${e.landingRate}%).`,
      `① 랜딩 페이지가 모바일에서 빠르게 뜨는지·링크가 올바른지 확인해보세요.`,
      `② 광고 메시지와 페이지 첫 화면의 메시지가 일치하는지 점검해보세요.`,
      `③ 클릭 후 이탈이 많다면 타겟을 더 정교하게 좁혀보세요.`,
    ],
  };
}

function OptCard({ icon, good, title, lines, children }: { icon: IconName; good: boolean; title: string; lines: string[]; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: 14, border: "1px solid var(--w-line-alternative)", borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: good ? "rgba(0,191,64,0.10)" : "rgba(255,146,0,0.12)", color: good ? "var(--w-status-positive)" : "var(--w-status-cautionary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={icon} size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">{title}</div>
        {lines.map((l, j) => <div key={j} className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-neutral)]" style={{ marginTop: 4 }}>{l}</div>)}
        {children && <div style={{ marginTop: 12 }}>{children}</div>}
      </div>
    </div>
  );
}

function DetailErrorCard({ icon = "warn", title, reason, ctaLabel, onAction }: { icon?: IconName; title: string; reason: string; ctaLabel: string; onAction: () => void }) {
  return (
    <Card className="py-10 px-8 flex flex-col items-center gap-3 text-center">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name={icon} size={24} /></div>
      <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]">{title}</div>
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ maxWidth: 380 }}>{reason}</div>
      <Button variant="secondary" type="button" style={{ marginTop: 8 }} onClick={onAction}>{ctaLabel}</Button>
    </Card>
  );
}

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "자세히 알아보기", SHOP_NOW: "지금 구매", SIGN_UP: "가입하기",
  DOWNLOAD: "다운로드", MESSAGE_PAGE: "메시지 보내기", CALL_NOW: "전화하기",
  GET_OFFER: "오퍼 받기", SUBSCRIBE: "구독하기", ORDER_NOW: "주문하기", WATCH_MORE: "더 보기",
};
const PLATFORM_LABELS: Record<string, string> = {
  both: "FB + IG (자동 최적화)", facebook: "페이스북", instagram: "인스타그램",
};
const PLACEMENT_LABELS: Record<string, string> = {
  facebook_feed: "페이스북 피드", instagram_feed: "인스타그램 피드",
  instagram_stories: "인스타그램 스토리", audience_network: "오디언스 네트워크", messenger: "메신저",
};

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="font-medium text-[12.5px] leading-[1.6] text-[var(--w-fg-alternative)] whitespace-nowrap">{label}</span>
      <span className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-strong)]">{value}</span>
    </>
  );
}

function SettingsSubhead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ minHeight: 28 }}>
      <h4 className="font-bold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] m-0">{title}</h4>
      {action}
    </div>
  );
}

function CampaignConfigurationTab({ c, isLoading, campaignId, onRefetch, isAbCampaign }: { c: CampaignSummary | undefined; isLoading: boolean; campaignId: string; onRefetch: () => void; isAbCampaign: boolean }) {
  const showToast = useToast();
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [budgetVal, setBudgetVal] = useState("");
  const [startDateVal, setStartDateVal] = useState("");
  const [endDateVal, setEndDateVal] = useState("");
  const [saving, setSaving] = useState(false);

  const openScheduleEdit = () => {
    setBudgetVal(c?.dailyBudget ? String(c.dailyBudget) : "");
    setStartDateVal(c?.startDate ?? "");
    setEndDateVal(c?.endDate ?? "");
    setEditingSchedule(true);
  };

  const saveSchedule = async () => {
    const payload: { dailyBudget?: number; startDate?: string; endDate?: string | null } = {};
    const budget = Number(budgetVal);
    if (budgetVal && budget !== (c?.dailyBudget ?? 0)) payload.dailyBudget = budget;
    if (startDateVal && startDateVal !== c?.startDate) payload.startDate = startDateVal;
    if (endDateVal !== (c?.endDate ?? "")) payload.endDate = endDateVal || null;
    if (Object.keys(payload).length === 0) { setEditingSchedule(false); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adSet: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "수정에 실패했어요");
      showToast("일정·예산을 수정했어요");
      setEditingSchedule(false);
      onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "수정에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  const budgetNum = Number(budgetVal);
  const originalBudget = c?.dailyBudget ?? 0;
  const bigBudgetChange = budgetVal !== "" && originalBudget > 0 && (budgetNum >= originalBudget * 2 || budgetNum <= originalBudget * 0.5);

  const [editingTargeting, setEditingTargeting] = useState(false);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 65]);
  const [genders, setGenders] = useState<number[]>([]);
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [savingTargeting, setSavingTargeting] = useState(false);

  const openTargetingEdit = () => {
    setAgeRange([c?.ageMin ?? 18, c?.ageMax ?? 65]);
    setGenders(c?.genders ?? []);
    setTargetCountries(c?.countries ?? []);
    setEditingTargeting(true);
  };

  const saveTargeting = async () => {
    const payload = {
      ageMin: ageRange[0],
      ageMax: ageRange[1],
      genders,
      countries: targetCountries,
    };
    setSavingTargeting(true);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adSet: { targeting: payload } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "수정에 실패했어요");
      showToast("타겟팅을 수정했어요");
      setEditingTargeting(false);
      onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "수정에 실패했어요");
    } finally {
      setSavingTargeting(false);
    }
  };

  const toggleCountry = (code: string) =>
    setTargetCountries((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);

  const toggleGender = (g: number) =>
    setGenders((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);

  const [editingBid, setEditingBid] = useState(false);
  const [bidStrategy, setBidStrategy] = useState<"LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP">("LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState("");
  const [editPlatforms, setEditPlatforms] = useState<"both" | "facebook" | "instagram">("both");
  const [placementMode, setPlacementMode] = useState<"auto" | "manual">("auto");
  const [placementPositions, setPlacementPositions] = useState<string[]>([]);
  const [savingBid, setSavingBid] = useState(false);

  const openBidEdit = () => {
    setBidStrategy((c?.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP") as typeof bidStrategy);
    setBidAmount(c?.bidAmount ? String(c.bidAmount) : "");
    setEditPlatforms(c?.platforms ?? "both");
    setPlacementMode(c?.placementMode ?? "auto");
    setPlacementPositions(c?.placementPositions ?? []);
    setEditingBid(true);
  };

  const saveBid = async () => {
    const adSet: Record<string, unknown> = { bidStrategy };
    adSet.bidAmount = bidStrategy === "LOWEST_COST_WITHOUT_CAP" ? null : (bidAmount ? Number(bidAmount) : null);
    adSet.platforms = editPlatforms;
    adSet.placements = placementMode === "auto" ? { mode: "auto" } : { mode: "manual", positions: placementPositions };
    setSavingBid(true);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adSet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "수정에 실패했어요");
      showToast("입찰·배치를 수정했어요");
      setEditingBid(false);
      onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "수정에 실패했어요");
    } finally {
      setSavingBid(false);
    }
  };

  const togglePosition = (pos: string) =>
    setPlacementPositions((prev) => prev.includes(pos) ? prev.filter((x) => x !== pos) : [...prev, pos]);

  const [editingCreative, setEditingCreative] = useState(false);
  const [creativeHeadline, setCreativeHeadline] = useState("");
  const [creativePrimaryText, setCreativePrimaryText] = useState("");
  const [imageMode, setImageMode] = useState<"keep" | "upload">("keep");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [showCreativeConfirm, setShowCreativeConfirm] = useState(false);
  const [savingCreative, setSavingCreative] = useState(false);

  const openCreativeEdit = () => {
    setCreativeHeadline(c?.headline ?? "");
    setCreativePrimaryText(c?.primaryText ?? "");
    setImageMode("keep");
    setImageFile(null);
    setImageDataUrl(null);
    setEditingCreative(true);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImageDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const doReplaceCreative = async () => {
    setSavingCreative(true);
    try {
      const body: Record<string, unknown> = {
        headline: creativeHeadline,
        primaryText: creativePrimaryText,
      };
      if (imageMode === "keep") {
        body.reuseExistingImage = true;
      } else if (imageDataUrl) {
        body.imageDataUrl = imageDataUrl;
      }
      const res = await fetch(`/api/campaign/${campaignId}/replace-creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "소재 교체에 실패했어요");
      showToast("소재를 교체했어요. Meta 검토 후 게재돼요.");
      setEditingCreative(false);
      setShowCreativeConfirm(false);
      onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "소재 교체에 실패했어요");
    } finally {
      setSavingCreative(false);
    }
  };

  const submitCreative = () => {
    if (c?.status === "live" || c?.status === "issue") {
      setShowCreativeConfirm(true);
    } else {
      doReplaceCreative();
    }
  };

  if (isLoading || !c) {
    return (
      <Card className="flex justify-center py-10 px-8">
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-7 h-7" />
      </Card>
    );
  }

  const genderLabel = !c.genders || c.genders.length === 0
    ? "전체"
    : c.genders.includes(1) && c.genders.includes(2) ? "전체"
    : c.genders.includes(1) ? "남성" : "여성";

  const platformLabel = c.platforms ? (PLATFORM_LABELS[c.platforms] ?? c.platforms) : "FB + IG (자동 최적화)";

  const placementLabel = c.placementMode === "manual" && c.placementPositions?.length
    ? c.placementPositions.map((p) => PLACEMENT_LABELS[p] ?? p).join(", ")
    : "자동 (Advantage+)";

  const dash = <span style={{ color: "var(--w-fg-alternative)" }}>—</span>;

  return (
    <>

      <Card style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 0 }}>
          <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0" style={{ marginBottom: 0 }}>소재</h3>
          {!editingCreative && c.status !== "ended" && (
            isAbCampaign ? (
              <span title="A/B 시험 중에는 소재 수정 불가" className="inline-flex items-center gap-1 font-medium text-[12px] leading-none text-[var(--w-fg-alternative)]">
                <Icon name="lock" size={13} /> A/B 시험 중
              </span>
            ) : (
              <Button variant="ghost" size="sm" type="button" onClick={openCreativeEdit}>
                <Icon name="edit" size={13} /> 수정
              </Button>
            )
          )}
        </div>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        {editingCreative ? (
          <>
            {c.status === "issue" && c.issueReason && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(255,66,66,0.06)", border: "1px solid rgba(255,66,66,0.25)", display: "flex", gap: 8 }}>
                <Icon name="warn" size={14} style={{ color: "var(--w-status-negative)", flex: "0 0 auto", marginTop: 1 }} />
                <div>
                  <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-status-negative)]">거절 사유: {c.issueReason.summary}</div>
                  {c.issueReason.message !== c.issueReason.summary && (
                    <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 4 }}>{c.issueReason.message.slice(0, 200)}</div>
                  )}
                </div>
              </div>
            )}
            {c.status === "live" && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(255,146,0,0.08)", border: "1px solid rgba(255,146,0,0.25)", display: "flex", gap: 8 }}>
                <Icon name="warn" size={14} style={{ color: "var(--w-status-cautionary)", flex: "0 0 auto", marginTop: 1 }} />
                <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">소재 교체는 <strong>성과 안정화 구간 재시작 + 재심사</strong>를 일으켜요. 검토 동안 이전 소재가 잠시 노출될 수 있어요.</span>
              </div>
            )}
            {c.status === "paused" && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "var(--w-bg-alternative)", display: "flex", gap: 8 }}>
                <Icon name="info" size={14} style={{ color: "var(--w-fg-alternative)", flex: "0 0 auto", marginTop: 1 }} />
                <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">재개 시 새 소재로 검토받아요.</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>헤드라인</div>
                <input className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]" type="text" value={creativeHeadline} onChange={(e) => setCreativeHeadline(e.target.value)} />
              </div>
              <div>
                <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>본문</div>
                <textarea className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]" rows={3} value={creativePrimaryText} onChange={(e) => setCreativePrimaryText(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div>
                <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 8 }}>이미지</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {([{ val: "keep", label: "그대로 유지" }, { val: "upload", label: "직접 업로드" }] as const).map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setImageMode(val)}
                      style={{ padding: "6px 14px", borderRadius: 8, font: "600 12.5px/1 var(--w-font-sans)", cursor: "pointer",
                        border: imageMode === val ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                        background: imageMode === val ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                        color: imageMode === val ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>
                      {label}
                    </button>
                  ))}
                </div>
                {imageMode === "upload" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <label className={buttonVariants({ variant: "secondary", size: "sm" })} style={{ cursor: "pointer" }}>
                      <Icon name="upload" size={13} /> 파일 선택
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} />
                    </label>
                    {imageFile && <span className="font-medium text-[12px] leading-[1.3] text-[var(--w-fg-neutral)]">{imageFile.name}</span>}
                    {imageDataUrl && <img src={imageDataUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" size="sm" type="button"
                  disabled={savingCreative || !creativeHeadline.trim() || !creativePrimaryText.trim() || (imageMode === "upload" && !imageDataUrl)}
                  onClick={submitCreative}>
                  {savingCreative ? "교체 중…" : "소재 교체"}
                </Button>
                <Button variant="ghost" size="sm" type="button" disabled={savingCreative} onClick={() => setEditingCreative(false)}>
                  취소
                </Button>
              </div>
            </div>
            {showCreativeConfirm && (
              <ConfirmModal
                tone="primary"
                title="이 변경은 성과 안정화 구간 재시작과 재심사를 일으켜요"
                desc="Meta가 새 소재를 다시 검토해요. 보통 수 분 ~ 수 시간. 검토 동안 이전 소재가 잠시 노출될 수 있어요. 검토 통과 후 게재가 다시 시작돼요."
                confirmLabel="변경 적용"
                onClose={() => setShowCreativeConfirm(false)}
                onConfirm={doReplaceCreative}
              />
            )}
          </>
        ) : (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ width: 112, height: 112, borderRadius: 12, background: campaignGradient(campaignId), flex: "0 0 auto", overflow: "hidden" }}>
            {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 24px", alignItems: "start" }}>
            <ConfigRow label="헤드라인" value={c.headline} />
            <ConfigRow label="본문" value={c.primaryText ?? dash} />
            <ConfigRow label="CTA" value={c.cta ? (CTA_LABELS[c.cta] ?? c.cta) : dash} />
            <ConfigRow label="랜딩 URL" value={c.landingUrl
              ? <a href={c.landingUrl} target="_blank" rel="noreferrer" className="font-medium text-[12.5px] leading-[1.4]" style={{ color: "var(--w-primary-normal)", wordBreak: "break-all" }}>{c.landingUrl}</a>
              : dash}
            />
          </div>
        </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0">설정</h3>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 24px", alignItems: "center" }}>
          <ConfigRow label="캠페인 목표" value={c.goal} />
          <ConfigRow label="상태" value={<Chip variant={(STATUS_CHIP[c.status]?.chip ?? "neutral") as ChipVariant} dot>{STATUS_CHIP[c.status]?.label ?? c.status}</Chip>} />
          <ConfigRow label="Campaign ID" value={<span className="font-medium text-[12px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-alternative)]">{campaignId.slice(-10)}</span>} />
        </div>

        <hr className="h-px bg-[var(--w-line-alternative)] my-[18px] border-0" />
        <SettingsSubhead title="일정 · 예산" action={!editingSchedule && c.status !== "ended" && (
          <Button variant="ghost" size="sm" type="button" onClick={openScheduleEdit}><Icon name="edit" size={13} /> 수정</Button>
        )} />
        <div style={{ marginTop: 14 }}>
        {editingSchedule ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>일 예산 (₩)</div>
              <input
                className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
                type="number"
                min={10000}
                step={1000}
                value={budgetVal}
                onChange={(e) => setBudgetVal(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              {bigBudgetChange && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(255,146,0,0.08)", border: "1px solid rgba(255,146,0,0.25)" }}>
                  <Icon name="warn" size={13} style={{ color: "var(--w-status-cautionary)", flex: "0 0 auto" }} />
                  <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">큰 예산 변경은 성과 안정화 구간이 재시작될 수 있어요</span>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>시작일</div>
                <DatePicker value={startDateVal} onChange={setStartDateVal} aria-label="시작일" />
              </div>
              <div>
                <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>종료일</div>
                <DatePicker value={endDateVal} onChange={setEndDateVal} placeholder="종료일 없음" aria-label="종료일" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" size="sm" type="button" disabled={saving} onClick={saveSchedule}>
                {saving ? "저장 중…" : "저장"}
              </Button>
              <Button variant="ghost" size="sm" type="button" disabled={saving} onClick={() => setEditingSchedule(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 24px", alignItems: "center" }}>
            <ConfigRow label="시작일" value={c.startDate ?? dash} />
            <ConfigRow label="종료일" value={c.endDate ?? dash} />
            <ConfigRow label="일 예산" value={c.dailyBudget ? fmtKRW(c.dailyBudget) : dash} />
          </div>
        )}
        </div>

        <hr className="h-px bg-[var(--w-line-alternative)] my-[18px] border-0" />
        <SettingsSubhead title="타겟팅" action={!editingTargeting && c.status !== "ended" && (
          <Button variant="ghost" size="sm" type="button" onClick={openTargetingEdit}><Icon name="edit" size={13} /> 수정</Button>
        )} />
        <div style={{ marginTop: 14 }}>
        {editingTargeting ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 10 }}>연령</div>
              <AgeRange value={ageRange} onChange={setAgeRange} />
            </div>
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 8 }}>성별</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ label: "모두", val: [] as number[] }, { label: "남성", val: [1] }, { label: "여성", val: [2] }].map(({ label, val }) => {
                  const active = val.length === 0 ? genders.length === 0 : genders.length === 1 && genders[0] === val[0];
                  return (
                    <button key={label} type="button" onClick={() => setGenders(val)}
                      style={{ padding: "6px 14px", borderRadius: 8, font: "600 12.5px/1 var(--w-font-sans)", cursor: "pointer",
                        border: active ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                        background: active ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                        color: active ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 8 }}>국가</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COUNTRIES.map((ct) => {
                  const on = targetCountries.includes(ct.code);
                  return (
                    <button key={ct.code} type="button" onClick={() => toggleCountry(ct.code)}
                      style={{ padding: "5px 12px", borderRadius: 8, font: "600 12px/1 var(--w-font-sans)", cursor: "pointer",
                        border: on ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                        background: on ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                        color: on ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>
                      {ct.label}
                    </button>
                  );
                })}
              </div>
              {targetCountries.length === 0 && (
                <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-status-negative)]" style={{ marginTop: 6 }}>국가를 최소 1개 선택해주세요</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" size="sm" type="button" disabled={savingTargeting || targetCountries.length === 0} onClick={saveTargeting}>
                {savingTargeting ? "저장 중…" : "저장"}
              </Button>
              <Button variant="ghost" size="sm" type="button" disabled={savingTargeting} onClick={() => setEditingTargeting(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 24px", alignItems: "center" }}>
            <ConfigRow label="연령" value={c.ageMin != null && c.ageMax != null ? `${c.ageMin}~${c.ageMax}세` : dash} />
            <ConfigRow label="성별" value={genderLabel} />
            <ConfigRow label="국가" value={c.countries?.length ? c.countries.join(", ") : dash} />
          </div>
        )}
        </div>

        <hr className="h-px bg-[var(--w-line-alternative)] my-[18px] border-0" />
        <SettingsSubhead title="입찰 · 배치" action={!editingBid && c.status !== "ended" && (
          <Button variant="ghost" size="sm" type="button" onClick={openBidEdit}><Icon name="edit" size={13} /> 수정</Button>
        )} />
        <div style={{ marginTop: 14 }}>
        {editingBid ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(255,146,0,0.08)", border: "1px solid rgba(255,146,0,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="warn" size={13} style={{ color: "var(--w-status-cautionary)", flex: "0 0 auto" }} />
              <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">입찰 전략·배치 변경은 성과 안정화 구간이 재시작될 수 있어요</span>
            </div>
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 8 }}>입찰 전략</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([
                  { val: "LOWEST_COST_WITHOUT_CAP", label: "최저 비용 (상한 없음)", desc: "Meta가 예산 내에서 가장 낮은 비용으로 결과를 최대화해요" },
                  { val: "LOWEST_COST_WITH_BID_CAP", label: "최저 비용 (입찰 상한)", desc: "입찰 상한을 설정해 클릭당 최대 비용을 제어해요" },
                  { val: "COST_CAP", label: "목표 비용", desc: "평균 비용이 목표 금액을 넘지 않도록 유지해요" },
                ] as const).map(({ val, label, desc }) => (
                  <button key={val} type="button" onClick={() => setBidStrategy(val)}
                    style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      border: bidStrategy === val ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                      background: bidStrategy === val ? "var(--w-primary-soft)" : "var(--w-bg-normal)" }}>
                    <div className="font-semibold text-[13px] leading-[1.3]" style={{ color: bidStrategy === val ? "var(--w-primary-press)" : "var(--w-fg-strong)" }}>{label}</div>
                    <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]" style={{ marginTop: 3 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            {bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && (
              <div>
                <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>
                  {bidStrategy === "COST_CAP" ? "목표 비용 (₩)" : "입찰 상한 (₩)"}
                </div>
                <input className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]" type="number" min={100} step={100} value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)} style={{ maxWidth: 220 }} />
              </div>
            )}
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 8 }}>플랫폼</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([{ val: "both", label: "FB + IG" }, { val: "facebook", label: "페이스북만" }, { val: "instagram", label: "인스타그램만" }] as const).map(({ val, label }) => (
                  <button key={val} type="button" onClick={() => setEditPlatforms(val)}
                    style={{ padding: "6px 14px", borderRadius: 8, font: "600 12.5px/1 var(--w-font-sans)", cursor: "pointer",
                      border: editPlatforms === val ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                      background: editPlatforms === val ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                      color: editPlatforms === val ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 8 }}>배치</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {([{ val: "auto", label: "자동 (Advantage+)" }, { val: "manual", label: "수동" }] as const).map(({ val, label }) => (
                  <button key={val} type="button" onClick={() => {
                    setPlacementMode(val);
                    if (val === "manual" && placementPositions.length === 0) {
                      setPlacementPositions(editPlatforms === "facebook" ? ["facebook_feed"] : editPlatforms === "instagram" ? ["instagram_feed"] : ["facebook_feed", "instagram_feed"]);
                    }
                  }}
                    style={{ padding: "6px 14px", borderRadius: 8, font: "600 12.5px/1 var(--w-font-sans)", cursor: "pointer",
                      border: placementMode === val ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                      background: placementMode === val ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                      color: placementMode === val ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>
                    {label}
                  </button>
                ))}
              </div>
              {placementMode === "manual" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {([
                    { id: "facebook_feed", label: "Facebook 피드", platform: "facebook" },
                    { id: "instagram_feed", label: "Instagram 피드", platform: "instagram" },
                    { id: "instagram_stories", label: "Instagram 스토리", platform: "instagram" },
                    { id: "audience_network", label: "Audience Network", platform: "both" },
                    { id: "messenger", label: "Messenger", platform: "both" },
                  ]).map(({ id, label, platform }) => {
                    const enabled = editPlatforms === "both" || platform === "both" || platform === editPlatforms;
                    const on = placementPositions.includes(id);
                    return (
                      <button key={id} type="button" disabled={!enabled} onClick={() => togglePosition(id)}
                        style={{ padding: "5px 12px", borderRadius: 8, font: "600 12px/1 var(--w-font-sans)", cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.4,
                          border: on ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                          background: on ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                          color: on ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" size="sm" type="button" disabled={savingBid} onClick={saveBid}>
                {savingBid ? "저장 중…" : "저장"}
              </Button>
              <Button variant="ghost" size="sm" type="button" disabled={savingBid} onClick={() => setEditingBid(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 24px", alignItems: "center" }}>
            <ConfigRow label="입찰 전략" value={
              c.bidStrategy === "LOWEST_COST_WITH_BID_CAP" ? "최저 비용 (입찰 상한)"
              : c.bidStrategy === "COST_CAP" ? "목표 비용"
              : "최저 비용 (상한 없음)"
            } />
            {c.bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && c.bidAmount != null && (
              <ConfigRow label="입찰 금액" value={fmtKRW(c.bidAmount)} />
            )}
            <ConfigRow label="플랫폼" value={platformLabel} />
            <ConfigRow label="배치" value={placementLabel} />
          </div>
        )}
        </div>
      </Card>
    </>
  );
}

function EvidenceText({ evidence }: { evidence: WinnerEvidence }) {
  if (evidence.kind === "kpi-target") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-status-positive)]">🏆 KPI 목표 모두 통과</div>
        {evidence.passed.map((p, i) => (
          <div key={i} className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)]">
            {p.kpi.toUpperCase()} {p.current.toFixed(2)} (목표 {p.direction === "gte" ? "≥" : "≤"}{p.target})
          </div>
        ))}
      </div>
    );
  }
  const labels: Record<string, string> = {
    OUTCOME_TRAFFIC: "트래픽 광고",
    OUTCOME_AWARENESS: "인지도 광고",
    OUTCOME_ENGAGEMENT: "참여 광고",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-status-positive)]">
        🏆 {labels[evidence.objective] ?? "광고"} 호조 기준 통과
      </div>
      {evidence.passed.map((p, i) => (
        <div key={i} className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)]">
          {p.metric} {p.current.toFixed(2)} (기준 {p.threshold})
        </div>
      ))}
    </div>
  );
}

function RelaunchConfirmModal({
  campaignName, evidence, cycleCount, onlyOnce, onOnlyOnceChange,
  busy, error, onRelaunch, onEditOriginal, onClose,
}: {
  campaignName: string;
  evidence: WinnerEvidence | null;
  cycleCount: number;
  onlyOnce: boolean;
  onOnlyOnceChange: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  onRelaunch: () => void;
  onEditOriginal: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--w-bg-elevated)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        padding: "28px 28px 24px", maxWidth: 500, width: "calc(100vw - 32px)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        <div>
          <div className="font-bold text-[18px] leading-[1.25] tracking-[-0.016em] text-[var(--w-fg-strong)]">
            자동 재게재 — &apos;{campaignName}&apos;
          </div>
          {cycleCount > 1 && (
            <div className="font-medium text-[12.5px] leading-none text-[var(--w-fg-alternative)]" style={{ marginTop: 6 }}>
              📊 누적 {cycleCount}번째 사이클
            </div>
          )}
        </div>

        {evidence ? (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(0,191,64,0.06)", border: "1px solid rgba(0,191,64,0.20)" }}>
            <EvidenceText evidence={evidence} />
          </div>
        ) : (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--w-bg-alternative)" }}>
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              원본과 동일한 카피·이미지·타겟·예산으로 새 캠페인을 게재해요.
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(255,66,66,0.06)", border: "1px solid rgba(255,66,66,0.25)" }}>
            <div className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-status-negative)]">{error}</div>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={onlyOnce} onChange={(e) => onOnlyOnceChange(e.target.checked)} style={{ width: 15, height: 15 }} />
          <span className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)]">
            이번 사이클만 — 다음엔 자동 재게재 끄기
          </span>
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" type="button" onClick={onEditOriginal} style={{ flex: "0 0 auto" }}>
            원본을 수정해서 만들기
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>닫기</Button>
          <Button variant="primary" type="button" onClick={onRelaunch} disabled={busy}>
            {busy ? "처리 중…" : "재게재"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={null}>
      <CampaignDetailFlow />
    </Suspense>
  );
}
