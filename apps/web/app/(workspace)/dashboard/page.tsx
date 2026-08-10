"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { SegControl } from "@shared/ui/SegControl";
import { fmtKRW, campaignRunDays } from "@shared/lib/format";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { upsertProfile } from "@features/brand-profile/model/brandProfileStore";
import { bepRoas } from "@entities/insights/profit";
import { useGoalsStorage } from "@features/goal/model/useGoalsStorage";
import { deriveFunnel, pickWorstDrop, type AccountDailyPoint, type FunnelStage } from "@entities/insights/account-trend";
import {
  splitWindow,
  derivePeriodKpis,
  deriveConversionSummary,
  deriveRevenueRoasDelta,
  toCampaignTableRow,
  type CampaignTableRow,
} from "@entities/insights/period-kpis";
import { deriveActionQueue, deriveHeroNarrative, type ActionButton } from "@entities/insights/action-queue";
import { deriveAccountVerdict, deriveCampaignVerdicts, type AccountVerdictCampaign } from "@entities/insights/account-verdict";
import { buildRecent7Report, serializeReportText, toCampaignsCsv, type Recent7Report } from "@entities/insights/report";
import { listBrowse, BROWSE_CHANGE_EVENT } from "@entities/campaign/browse/store";
import { seedAutoPilotDemo } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import { fetchCampaigns } from "@entities/campaign/api";
import { billingQueryKey, fetchBilling } from "@entities/billing/api";
import BillingAlertWidget from "@widgets/billing-alert";
import { DashboardHero, DashboardHeroNoConversion, heroRangeLabel } from "@widgets/dashboard-hero";
import { ActionQueue } from "@widgets/action-queue";
import { EvidenceRail, buildEvidenceMetrics, funnelLeakNote } from "@widgets/evidence-rail";
import type { CampaignSummary } from "@/lib/meta-ads";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import { useToast } from "@shared/ui/Toast";

type Period = "7d" | "30d";
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30 };
const TREND_DAYS: Record<Period, number> = { "7d": 14, "30d": 60 };
const PERIOD_STORY: Record<Period, string> = { "7d": "최근 7일 성과", "30d": "최근 30일 성과" };

// ADR-063 — 퍼널 단 클릭 = 캠페인 목록으로 이동해 해당 기준으로 정렬. 대시보드에 표를 다시 만들지 않는다.
const FUNNEL_SORT_PRESET: Partial<Record<FunnelStage["key"], string>> = {
  clicks: "ctr",
  landing: "landingRate",
  purchase: "roas",
};

async function fetchDashboardCampaigns(period: Period): Promise<CampaignSummary[]> {
  try {
    return await fetchCampaigns(period);
  } catch (error) {
    if ((error as { code?: number }).code === 401) return [];
    throw error;
  }
}

// ADR-059 — 계정 횡단 일별 합산 추세. days = 델타 비교용 직전 기간 포함 창.
async function fetchTrend(days: number): Promise<AccountDailyPoint[]> {
  const res = await fetch(`/api/dashboard/trend?days=${days}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.daily ?? []) as AccountDailyPoint[];
}

function toVerdictCampaign(c: CampaignSummary): AccountVerdictCampaign {
  return {
    id: c.id,
    headline: c.headline,
    status: c.status,
    objective: c.objective,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.ctr,
    spend: c.spend,
    dailyBudget: c.dailyBudget,
    adSetId: c.adSetId,
    daysOfData: campaignRunDays(c.startDate, c.endDate),
    linkClick: c.linkClick,
    landingPageView: c.landingPageView,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const showToast = useToast();

  const accountConnected = !!(session?.adAccountName && session?.pageName);
  const [period, setPeriod] = useState<Period>("7d");

  const { profile: brandProfile, profiles: brandProfiles, activeId: brandActiveId } = useBrandProfileStorage(!!session?.browseMode);
  const marginRate = brandProfile.marginRate ?? null;
  const saveMargin = useCallback(
    (rate: number | null) => {
      const entry = brandProfiles.find((p) => p.id === brandActiveId);
      if (!entry) return;
      upsertProfile({ ...entry, marginRate: rate ?? undefined });
    },
    [brandProfiles, brandActiveId],
  );
  const goCreate = () => router.push("/create");
  const goConnect = () => router.push("/setup");

  const billingQ = useQuery({
    queryKey: billingQueryKey,
    queryFn: fetchBilling,
    enabled: !!session?.adAccountId,
    staleTime: 60_000,
  });

  const campaignsQ = useQuery({
    queryKey: ["campaigns", period],
    queryFn: () => fetchDashboardCampaigns(period),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 60_000,
  });

  // ADR-064 — 최근 7일 리포트는 대시보드 기간 토글(30일)과 무관하게 항상 7일 창. period="7d" 쿼리 고정 재사용(캐시 공유).
  const report7dCampaignsQ = useQuery({
    queryKey: ["campaigns", "7d"],
    queryFn: () => fetchDashboardCampaigns("7d"),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 60_000,
  });

  const browseMode = !!session?.browseMode;
  // ADR-033 — Browse Mode: /create 로 만든 캠페인(localStorage)을 진단/커버리지 계산에 merge.
  const [browseRows, setBrowseRows] = useState<CampaignSummary[]>([]);
  useEffect(() => {
    if (!browseMode) return;
    seedAutoPilotDemo();
    const load = () => setBrowseRows(listBrowse().map(browseCampaignToSummary));
    load();
    window.addEventListener(BROWSE_CHANGE_EVENT, load);
    return () => window.removeEventListener(BROWSE_CHANGE_EVENT, load);
  }, [browseMode]);

  const campaigns = campaignsQ.data ?? [];
  const allCampaigns = browseMode ? [...browseRows, ...campaigns] : campaigns;

  const report7dCampaigns = report7dCampaignsQ.data ?? [];
  const report7dTableCampaigns = browseMode ? [...browseRows, ...report7dCampaigns] : report7dCampaigns;

  const trendDays = TREND_DAYS[period];
  const trendQ = useQuery({
    queryKey: ["dashboard", "trend", trendDays],
    queryFn: () => fetchTrend(trendDays),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 5 * 60_000,
  });
  const dailyAll = trendQ.data ?? [];

  const { current: dailyCurrent, previous: dailyPrevious } = useMemo(
    () => splitWindow(dailyAll, PERIOD_DAYS[period]),
    [dailyAll, period],
  );

  const conversion = useMemo(() => deriveConversionSummary(campaigns), [campaigns]);
  const { goals } = useGoalsStorage(!!session?.browseMode);
  const periodKpis = useMemo(() => derivePeriodKpis(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);
  const revenueRoas = useMemo(() => deriveRevenueRoasDelta(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);

  const funnel = useMemo(
    () =>
      deriveFunnel(
        campaigns.map((c) => ({
          impressions: c.impressions,
          clicks: c.clicks,
          landingPageView: c.landingPageView,
          purchaseCount: c.purchaseCount,
        })),
      ),
    [campaigns],
  );
  // "도착 이후만 고치면 돼요" — 사람이 도달한 단(from)을 말해야 문장이 성립한다(to 를 쓰면 "구매 이후").
  const worstDrop = pickWorstDrop(funnel.stages);

  const narrative = useMemo(
    () =>
      deriveHeroNarrative({
        conversion,
        marginRate,
        clicksDeltaPct: periodKpis.clicks.deltaPct,
        cpcDeltaPct: periodKpis.cpc.deltaPct,
        leakStageLabel: worstDrop?.from.label,
      }),
    [conversion, marginRate, periodKpis.clicks.deltaPct, periodKpis.cpc.deltaPct, worstDrop?.from.label],
  );

  const actionItems = useMemo(
    () =>
      deriveActionQueue({
        campaigns: allCampaigns,
        marginRate,
        totalSpend: periodKpis.spend.value,
        roasDeltaPct: revenueRoas.roasApprox,
      }),
    [allCampaigns, marginRate, periodKpis.spend.value, revenueRoas.roasApprox],
  );

  const bep = bepRoas(marginRate);
  const evidenceMetrics = useMemo(
    () =>
      buildEvidenceMetrics({
        roas: conversion?.roas ?? null,
        roasDeltaPct: revenueRoas.roasApprox,
        bep,
        conversionCount: conversion?.conversionCount ?? null,
        revenue: revenueRoas.revenue.value,
        revenueDeltaPct: revenueRoas.revenue.deltaPct,
        cpa: conversion?.cpa ?? null,
        targetCpa:
          conversion && marginRate != null && conversion.conversionCount > 0
            ? Math.round((conversion.conversionValue / conversion.conversionCount) * marginRate)
            : null,
      }),
    [conversion, revenueRoas, dailyCurrent, bep, marginRate],
  );

  // ADR-064 — 최근 7일 리포트. 항상 splitWindow(dailyAll, 7) 재사용 — 대시보드 7일 토글과 같은 기간 정의·같은 숫자.
  const { current: report7dCurrent, previous: report7dPrevious } = useMemo(() => splitWindow(dailyAll, 7), [dailyAll]);
  const report7dKpis = useMemo(() => derivePeriodKpis(report7dCurrent, report7dPrevious), [report7dCurrent, report7dPrevious]);
  const report7dVerdict = useMemo(() => deriveAccountVerdict(report7dCampaigns.map(toVerdictCampaign)), [report7dCampaigns]);
  const report7dConversion = useMemo(() => deriveConversionSummary(report7dCampaigns), [report7dCampaigns]);
  const report7dVerdicts = useMemo(() => deriveCampaignVerdicts(report7dCampaigns.map(toVerdictCampaign)), [report7dCampaigns]);
  const report7dRows = useMemo(() => report7dTableCampaigns.map(toCampaignTableRow), [report7dTableCampaigns]);
  const recent7Report: Recent7Report = useMemo(
    () =>
      buildRecent7Report({
        current: report7dCurrent,
        previous: report7dPrevious,
        kpis: report7dKpis,
        verdict: report7dVerdict,
        campaignRows: report7dRows,
        campaignVerdicts: report7dVerdicts,
        conversionValue: report7dConversion?.conversionValue,
        conversionSpend: report7dConversion?.conversionSpend,
        marginRate,
      }),
    [report7dCurrent, report7dPrevious, report7dKpis, report7dVerdict, report7dRows, report7dVerdicts, report7dConversion, marginRate],
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);

  const loading = campaignsQ.isLoading || trendQ.isLoading;
  const hasData = !loading && campaigns.length > 0;

  const goMeasurement = () => router.push("/settings?tab=measure");
  const onAction = (b: ActionButton) => {
    switch (b.target.kind) {
      case "campaign":
        return router.push(`/campaigns/${b.target.id}`);
      case "campaigns":
        return router.push("/campaigns");
      case "measurement":
        return goMeasurement();
      case "margin":
        return setMarginOpen(true);
    }
  };
  const goFunnelStage = (key: FunnelStage["key"]) => {
    const sort = FUNNEL_SORT_PRESET[key];
    router.push(sort ? `/campaigns?sort=${sort}&dir=asc` : "/campaigns");
  };

  const rangeLabel = heroRangeLabel(dailyCurrent.map((d) => d.date));

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-5" data-screen-label="대시보드">
      <div className="flex justify-between items-center gap-4 h-11">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="w-h4 m-0">광고 현황</h1>
          {browseMode && <Chip variant="neutral" size="sm">둘러보기 예시</Chip>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SegControl
            value={period}
            onChange={setPeriod}
            options={[{ value: "7d", label: "7일" }, { value: "30d", label: "30일" }]}
          />
          <Button variant="secondary" type="button" onClick={() => setReportOpen(true)}>리포트 받기</Button>
          <Button variant="primary" type="button" onClick={goCreate}><Icon name="plus" size={16} /> 새 광고 만들기</Button>
        </div>
      </div>

      <Recent7ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        report={recent7Report}
        campaignRows={report7dRows}
        onCopy={() => {
          navigator.clipboard.writeText(serializeReportText(recent7Report));
          showToast("리포트를 복사했어요.");
        }}
        onExportCsv={() => downloadCampaignsCsv(report7dRows)}
      />
      <MarginDialog
        open={marginOpen}
        onOpenChange={setMarginOpen}
        marginRate={marginRate}
        onSave={(rate) => {
          saveMargin(rate);
          showToast("마진율을 저장했어요.");
        }}
      />

      {!accountConnected && !browseMode && (
        <Card className="flex items-center gap-4 border-[var(--w-status-cautionary-line)] bg-[var(--w-status-cautionary-soft)]">
          <Icon name="warn" size={20} className="shrink-0 text-[var(--w-status-cautionary)]" />
          <div className="flex-1">
            <div className="w-h4">광고 계정이 아직 연결되지 않았어요</div>
            <div className="w-caption mt-1">Meta 광고 계정과 페이지를 연결하면 광고를 만들고 집행할 수 있어요.</div>
          </div>
          <Button variant="primary" size="sm" type="button" onClick={goConnect}>연결하러 가기 <Icon name="arrow-right" size={14} /></Button>
        </Card>
      )}

      <BillingAlertWidget billing={billingQ.data} mode="top" />

      {!loading && campaigns.length === 0 ? (
        <NextStepSlot onCreate={goCreate} />
      ) : (
        <>
          {narrative || loading ? (
            <DashboardHero
              loading={loading}
              narrative={narrative}
              rangeLabel={rangeLabel}
              periodLabel={PERIOD_STORY[period]}
              onSetMargin={() => setMarginOpen(true)}
            />
          ) : (
            <DashboardHeroNoConversion
              loading={loading}
              spend={periodKpis.spend.value}
              clicks={periodKpis.clicks.value}
              impressions={periodKpis.impressions.value}
              ctr={periodKpis.ctr.value}
              cpc={periodKpis.cpc.value}
              rangeLabel={rangeLabel}
              periodLabel={PERIOD_STORY[period]}
              onMeasure={goMeasurement}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
            <ActionQueue loading={loading} items={actionItems} onAction={onAction} />
            <EvidenceRail
              loading={loading}
              metrics={evidenceMetrics}
              funnel={funnel}
              funnelNote={hasData ? funnelLeakNote(funnel.stages, (narrative?.contribution ?? 0) < 0) : undefined}
              onFunnelStage={goFunnelStage}
              goalEmpty={goals.length === 0}
              onSetGoal={() => router.push("/goals")}
            />
          </div>
        </>
      )}
    </div>
  );
}

function NextStepSlot({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center text-center gap-3 py-14 rounded-[20px]">
      <span className="grid place-items-center w-[72px] h-[72px] rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]">
        <Icon name="sparkles" size={32} />
      </span>
      <h3 className="w-display-editorial mt-1">첫 광고를 만들어 보세요</h3>
      <p className="w-body text-[var(--w-fg-neutral)] max-w-[420px]">
        브랜드 정보를 입력하면 AI가 카피와 이미지를 만들어 드려요. 게재가 시작되면 이 화면이 성과 대시보드로 바뀌어요.
      </p>
      <div className="mt-2">
        <Button variant="primary" size="md" type="button" onClick={onCreate}>
          <Icon name="plus" size={16} /> 첫 광고 만들기
        </Button>
      </div>
    </Card>
  );
}

// ── 마진율 입력 (기존 손익 카드의 편집 UI 를 모달로) ────────────────────────────
function MarginDialog({
  open, onOpenChange, marginRate, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marginRate: number | null;
  onSave: (rate: number) => void;
}) {
  // DialogContent 는 닫히면 언마운트된다 — 폼 상태를 자식에 두면 열 때마다 현재 마진율로 자동 초기화.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 440 }} className="flex flex-col p-6 gap-4">
        <MarginForm marginRate={marginRate} onSave={onSave} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MarginForm({ marginRate, onSave, onClose }: { marginRate: number | null; onSave: (rate: number) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => (marginRate != null ? String(Math.round(marginRate * 100)) : ""));

  const pct = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(pct) && pct > 0 && pct <= 100;
  const submit = () => {
    if (!valid) return;
    onSave(pct / 100);
    onClose();
  };

  return (
    <>
      <div>
        <DialogTitle className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">평균 마진율</DialogTitle>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
          광고비를 뺀 전 제품 평균 마진율이에요. 정확한 값이 아니어도 대략의 손익 방향을 볼 수 있어요.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-24 px-2.5 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[20px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] text-right focus:outline-none focus:border-[var(--w-focus-ring)]"
        />
        <span className="font-bold text-[20px] text-[var(--w-fg-neutral)]">%</span>
        {valid && (
          <span className="font-medium text-[13px] text-[var(--w-fg-neutral)] ml-2">
            손익분기 ROAS {(100 / pct).toFixed(2)}x
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="md" type="button" disabled={!valid} onClick={submit}>저장하고 손익 보기</Button>
        <Button variant="ghost" size="md" type="button" onClick={onClose}>취소</Button>
      </div>
    </>
  );
}

// ── 최근 7일 리포트 모달 (ADR-064) ──────────────────────────────────────────────
// 숫자는 전부 buildRecent7Report 산출물 그대로 렌더 — 모달에서 재계산 금지(대시보드 본문과 수치 불일치 원천 차단).
function downloadCampaignsCsv(rows: CampaignTableRow[]) {
  const csv = toCampaignsCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `광고성과_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Recent7ReportModal({
  open, onOpenChange, report, campaignRows, onCopy, onExportCsv,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Recent7Report;
  campaignRows: CampaignTableRow[];
  onCopy: () => void;
  onExportCsv: () => void;
}) {
  const rangeLabel =
    report.currentRangeLabel && report.previousRangeLabel
      ? `${report.currentRangeLabel} vs ${report.previousRangeLabel}`
      : report.currentRangeLabel ?? "기간 정보 없음";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 560 }} className="flex flex-col p-6 gap-5">
        <div>
          <DialogTitle className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">최근 7일 리포트</DialogTitle>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">{rangeLabel}</p>
        </div>

        <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)] px-3 py-2.5 rounded-xl bg-[var(--w-bg-alternative)]">
          {report.verdictHeadline}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {report.kpiDeltas.map((kpi) => (
            <div key={kpi.label} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border border-[var(--w-line-normal)]">
              <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">{kpi.label}</span>
              <span className="font-bold text-[14px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{kpi.value}</span>
              {kpi.deltaPct != null && (
                <span
                  className="font-semibold text-[11px] leading-none"
                  style={{ color: kpi.deltaPct >= 0 ? "var(--w-status-positive)" : "var(--w-status-negative)" }}
                >
                  {kpi.deltaPct >= 0 ? "+" : ""}{kpi.deltaPct.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>

        {report.topSpendCampaigns.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">지출 상위 3</h3>
            <div className="flex flex-col gap-1.5">
              {report.topSpendCampaigns.map((c, i) => (
                <div key={`${c.headline}-${i}`} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-[var(--w-fg-strong)] truncate">{i + 1}. {c.headline}</span>
                  <span className="font-medium [font-family:var(--w-font-mono)] text-[var(--w-fg-neutral)] shrink-0">{fmtKRW(c.spend)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.attentionCampaigns.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">손볼 캠페인 {report.attentionCampaigns.length}건</h3>
            <div className="flex flex-col gap-1.5">
              {report.attentionCampaigns.map((c, i) => (
                <div key={`${c.headline}-${i}`} className="flex items-center gap-2 text-[13px]">
                  <Icon name="warn" size={13} className="shrink-0 text-[var(--w-status-negative)]" />
                  <span className="font-medium text-[var(--w-fg-strong)] truncate">{c.headline}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.profit && (
          <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-[var(--w-bg-alternative)]">
            <span className="font-medium text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">공헌이익 · 손익</span>
            <span className="font-bold text-[18px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmtKRW(report.profit.contribution ?? 0)}</span>
            {report.profit.bepRoas != null && (
              <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">손익분기 ROAS {report.profit.bepRoas.toFixed(2)}x · 마진율 {report.profit.marginRatePct}% 가정</span>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="primary" size="md" type="button" onClick={onCopy}><Icon name="copy" size={15} /> 리포트 복사</Button>
          <Button variant="secondary" size="md" type="button" onClick={onExportCsv} disabled={campaignRows.length === 0}><Icon name="doc" size={15} /> CSV 내보내기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
