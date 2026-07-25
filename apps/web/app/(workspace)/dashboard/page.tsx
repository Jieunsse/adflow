"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Sparkline } from "@shared/ui/primitives";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { SegControl } from "@shared/ui/SegControl";
import { cn } from "@shared/lib/cn";
import { fmt, fmtKRW, shortDate, campaignRunDays } from "@shared/lib/format";
import SpendPerfFlowCard from "@shared/ui/SpendPerfFlowCard";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { upsertProfile } from "@features/brand-profile/model/brandProfileStore";
import { deriveAccountVerdict, deriveCampaignVerdicts, type AccountVerdict, type AccountVerdictCampaign } from "@entities/insights/account-verdict";
import { contributionMargin, bepRoas } from "@entities/insights/profit";
import { pickMostAtRisk } from "@entities/insights/goal";
import { useGoalsStorage } from "@features/goal/model/useGoalsStorage";
import GoalProgressBadge from "@features/goal/ui/GoalProgressBadge";
import { pickPerfAxis, deriveFunnel, deriveEfficiency, deriveTrendMetrics, perfLineLabel, trendSubtitle, type AccountDailyPoint, type FunnelStage } from "@entities/insights/account-trend";
import { GOOD_CTR_PCT } from "@entities/insights/thresholds";
import {
  splitWindow,
  derivePeriodKpis,
  deltaTone,
  deriveConversionSummary,
  deriveRevenueRoasDelta,
  toCampaignTableRow,
  sortCampaignRows,
  type KpiDeltaTone,
  type CampaignTableSortKey,
  type SortDir,
  type CampaignTableRow,
} from "@entities/insights/period-kpis";
import { buildRecent7Report, serializeReportText, toCampaignsCsv, type Recent7Report } from "@entities/insights/report";
import { listBrowse, BROWSE_CHANGE_EVENT } from "@entities/campaign/browse/store";
import { seedAutoPilotDemo } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import { CAMPAIGN_STATUS_MAP } from "@entities/campaign/status";
import BillingAlertWidget from "@widgets/billing-alert";
import type { Billing } from "@entities/billing/types";
import type { CampaignSummary } from "@/lib/meta-ads";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import { useToast } from "@shared/ui/Toast";

type Period = "7d" | "30d";
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30 };
const TREND_DAYS: Record<Period, number> = { "7d": 14, "30d": 60 };

async function fetchBilling(): Promise<Billing> {
  const res = await fetch("/api/billing");
  if (!res.ok) throw new Error("결제 정보를 불러오지 못했어요");
  return res.json();
}

async function fetchCampaigns(period: Period): Promise<CampaignSummary[]> {
  const res = await fetch(`/api/campaigns?period=${period}`);
  if (res.status === 401) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "캠페인을 불러오지 못했어요");
  return (data.campaigns ?? []) as CampaignSummary[];
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
  const name = session?.user?.name?.trim();
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
    queryKey: ["billing"],
    queryFn: fetchBilling,
    enabled: !!session?.adAccountId,
    staleTime: 60_000,
  });

  const campaignsQ = useQuery({
    queryKey: ["campaigns", period],
    queryFn: () => fetchCampaigns(period),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 60_000,
  });

  // ADR-064 — 최근 7일 리포트는 대시보드 기간 토글(30일)과 무관하게 항상 7일 창. period="7d" 쿼리 고정 재사용(캐시 공유).
  const report7dCampaignsQ = useQuery({
    queryKey: ["campaigns", "7d"],
    queryFn: () => fetchCampaigns("7d"),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 60_000,
  });

  const browseMode = !!session?.browseMode;
  // ADR-033 — Browse Mode: /create 로 만든 캠페인(localStorage)을 캠페인 테이블에만 merge. KPI/추세/평결은 실 API 집계 유지.
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
  const tableCampaigns = browseMode ? [...browseRows, ...campaigns] : campaigns;

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

  const verdict = useMemo(() => deriveAccountVerdict(campaigns.map(toVerdictCampaign)), [campaigns]);

  const conversion = useMemo(() => deriveConversionSummary(campaigns), [campaigns]);
  const { goals, marginRate: goalMarginRate } = useGoalsStorage(!!session?.browseMode);
  const topGoal = useMemo(
    () => pickMostAtRisk(goals, { roas: conversion?.roas, cpa: conversion?.cpa }, goalMarginRate),
    [goals, conversion, goalMarginRate],
  );
  const periodKpis = useMemo(() => derivePeriodKpis(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);
  const revenueRoas = useMemo(() => deriveRevenueRoasDelta(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);

  const conversionCampaigns = campaigns.filter((c) => c.objective === "OUTCOME_SALES" && c.purchaseValue != null);
  const perfAxis = useMemo(() => pickPerfAxis(dailyCurrent, conversionCampaigns.length), [dailyCurrent, conversionCampaigns.length]);
  const trendMetrics = useMemo(() => deriveTrendMetrics(dailyCurrent, perfAxis), [dailyCurrent, perfAxis]);
  const funnel = useMemo(
    () => deriveFunnel(campaigns.map((c) => ({ impressions: c.impressions, clicks: c.clicks, landingPageView: c.landingPageView, purchaseCount: c.purchaseCount }))),
    [campaigns],
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

  const [sortKey, setSortKey] = useState<CampaignTableSortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const tableRows = useMemo(() => {
    const rows = tableCampaigns.map(toCampaignTableRow);
    return sortCampaignRows(rows, sortKey, sortDir);
  }, [tableCampaigns, sortKey, sortDir]);
  const visibleRows = tableRows.slice(0, 5);
  const landingMeasuredCount = useMemo(() => tableCampaigns.filter((c) => c.linkClick != null).length, [tableCampaigns]);

  const toggleSort = (key: CampaignTableSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // ADR-063 — 퍼널 단 클릭 = 기존 캠페인 테이블 정렬 프리셋 전환 + 스크롤. 새 테이블 신설 금지.
  const tableRef = useRef<HTMLDivElement>(null);
  const FUNNEL_SORT_PRESET: Partial<Record<FunnelStage["key"], CampaignTableSortKey>> = {
    clicks: "ctr",
    landing: "landingRate",
    purchase: "roas",
  };
  const goFunnelStage = (stageKey: FunnelStage["key"]) => {
    const key = FUNNEL_SORT_PRESET[stageKey];
    if (!key) return;
    setSortKey(key);
    setSortDir("asc");
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loading = campaignsQ.isLoading;
  const evidenceLoading = campaignsQ.isLoading || trendQ.isLoading;
  const volume: "empty" | "seeding" | "full" = evidenceLoading
    ? "full"
    : campaigns.length === 0
      ? "empty"
      : dailyCurrent.length < 2
        ? "seeding"
        : "full";

  const spendTrend = dailyCurrent.length >= 2 ? dailyCurrent.map((d) => d.spend) : undefined;
  const impressionsTrend = dailyCurrent.length >= 2 ? dailyCurrent.map((d) => d.impressions) : undefined;

  const todaySpend = dailyCurrent.length > 0 ? dailyCurrent[dailyCurrent.length - 1] : null;
  const yesterdaySpend = dailyCurrent.length > 1 ? dailyCurrent[dailyCurrent.length - 2] : null;
  const todaySpendDeltaPct =
    todaySpend && yesterdaySpend && yesterdaySpend.spend > 0
      ? ((todaySpend.spend - yesterdaySpend.spend) / yesterdaySpend.spend) * 100
      : undefined;

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-6" data-screen-label="대시보드">
      <div className="flex justify-between items-center gap-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">대시보드</span>
          {session?.browseMode && <Chip variant="neutral" size="sm">예시</Chip>}
          <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] truncate">
            안녕하세요{name ? `, ${name}님` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SegControl
            value={period}
            onChange={setPeriod}
            options={[{ value: "7d", label: "7일" }, { value: "30d", label: "30일" }]}
          />
          <Button variant="secondary" type="button" onClick={() => setReportOpen(true)}><Icon name="doc" size={16} /> 최근 7일 리포트</Button>
          <Button variant="secondary" type="button" onClick={() => router.push("/campaigns")}>캠페인 목록</Button>
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

      {!accountConnected && !session?.browseMode && (
        <Card className="flex items-center gap-4 border-[var(--w-status-cautionary-line)] bg-[var(--w-status-cautionary-soft)]">
          <Icon name="warn" size={20} className="shrink-0 text-[var(--w-status-cautionary)]" />
          <div className="flex-1">
            <div className="font-semibold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">광고 계정이 아직 연결되지 않았어요</div>
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px]">Meta 광고 계정과 페이지를 연결하면 광고를 만들고 집행할 수 있어요.</div>
          </div>
          <Button variant="primary" size="sm" type="button" onClick={goConnect}>연결하러 가기 <Icon name="arrow-right" size={14} /></Button>
        </Card>
      )}

      <BillingAlertWidget billing={billingQ.data} mode="top" />

      {loading ? (
        <Skeleton className="h-[56px] rounded-2xl" />
      ) : (
        <VerdictBanner verdict={verdict} onDetail={(id) => router.push(`/campaigns/${id}`)} />
      )}

      <GoalProgressBadge top={topGoal} totalCount={goals.length} loading={loading} />

      {volume === "empty" ? (
        <NextStepSlot onCreate={goCreate} />
      ) : (
        <>
          <KpiStrip
            loading={loading || trendQ.isLoading}
            kpis={periodKpis}
            revenue={revenueRoas.revenue}
            roasDeltaPct={revenueRoas.roasApprox}
            conversion={conversion}
            todaySpend={todaySpend?.spend}
            todaySpendDeltaPct={todaySpendDeltaPct}
            spendTrend={spendTrend}
            impressionsTrend={impressionsTrend}
          />

          <SpendPerfFlowCard
            loading={loading || trendQ.isLoading}
            enough={dailyCurrent.length >= 2}
            labels={dailyCurrent.map((d) => shortDate(d.date))}
            spend={dailyCurrent.map((d) => d.spend)}
            efficiency={deriveEfficiency(dailyCurrent, perfAxis)}
            verdict={trendMetrics.verdict}
            perfLabel={perfLineLabel(perfAxis)}
            shortLabel={perfAxis.label}
            subtitle={trendSubtitle(trendMetrics.verdict, perfAxis)}
            midIndex={trendMetrics.midIndex}
            earlyAvg={trendMetrics.earlyAvg}
            lateAvg={trendMetrics.lateAvg}
            divergeRange={trendMetrics.divergeRange}
            isDemo={!!session?.browseMode}
            emptyTitle={"성과 흐름이 모이는 중"}
            emptyDesc={"광고가 며칠 더 게재되면 지출 대비 성과 흐름을 보여드려요."}
            onSeeCampaigns={() => router.push("/campaigns")}
          />

          <CampaignTable
            rows={visibleRows}
            total={tableRows.length}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            onRowClick={(id) => router.push(`/campaigns/${id}`)}
            onSeeAll={() => router.push("/campaigns")}
            landingMeasuredCount={landingMeasuredCount}
            tableRef={tableRef}
          />

          <div className="grid grid-cols-2 gap-5">
            <FunnelCard loading={loading} stages={funnel.stages} hasData={funnel.hasData} onStageClick={goFunnelStage} />
            {conversionCampaigns.length > 0 && conversion && (
              <ProfitCard
                conversionValue={conversion.conversionValue}
                conversionSpend={conversion.conversionSpend}
                roas={conversion.roas}
                count={conversion.count}
                marginRate={marginRate}
                onSaveMargin={saveMargin}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── 평결 컴팩트 배너 — 1줄. trap 만 경고색 강조. ────────────────────────────
const VERDICT_UI: Record<AccountVerdict["status"], { tone: "positive" | "negative" | "cautionary"; icon: "warn" | "trend-up" | "check-circle" | "clock" }> = {
  collecting: { tone: "cautionary", icon: "clock" },
  trap: { tone: "negative", icon: "warn" },
  poor: { tone: "negative", icon: "warn" },
  cruising: { tone: "positive", icon: "trend-up" },
  stable: { tone: "positive", icon: "check-circle" },
};

function VerdictBanner({ verdict, onDetail }: { verdict: AccountVerdict; onDetail: (campaignId: string) => void }) {
  const ui = VERDICT_UI[verdict.status];
  const emphasize = verdict.status === "trap";
  const accent = `var(--w-status-${ui.tone})`;
  const action = verdict.primaryAction;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: emphasize ? `var(--w-status-${ui.tone}-soft)` : "var(--w-bg-alternative)",
        borderLeft: emphasize ? `3px solid ${accent}` : undefined,
      }}
    >
      <Icon name={ui.icon} size={16} className="shrink-0" style={{ color: emphasize ? accent : "var(--w-fg-neutral)" }} />
      <span className="flex-1 min-w-0 font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)] truncate">
        {verdict.headline}
      </span>
      {action && (
        <button
          type="button"
          onClick={() => onDetail(action.campaignId)}
          className="shrink-0 font-semibold text-[13px] text-[var(--w-primary-press)] hover:underline"
        >
          {action.label} →
        </button>
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

// ── KPI 스트립 ────────────────────────────────────────────────────────────────
function DeltaChip({ deltaPct, tone }: { deltaPct?: number; tone: KpiDeltaTone }) {
  if (deltaPct == null) return null;
  const up = deltaPct > 0;
  // 주식처럼 방향으로만 색을 정한다 — 상승=빨강, 하락=파랑. tone(호/불호)은 무시.
  const color = tone === "neutral" ? "var(--w-fg-neutral)" : up ? "var(--w-status-negative)" : "var(--w-status-info)";
  const bg = tone === "neutral" ? "var(--w-bg-alternative)" : up ? "var(--w-status-negative-soft)" : "var(--w-status-info-soft)";
  return (
    <span
      className="inline-flex items-center gap-1 font-semibold text-[11px] leading-none px-2 py-1 rounded-full"
      style={{ color, background: bg }}
    >
      <Icon name={up ? "trend-up" : "trend-down"} size={11} />
      {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}

// 1차 지표 — 스파크라인 포함 큰 타일. 지출·ROAS만 (전 계정 손익 판단의 최상위 축).
function KpiTileBig({
  label, value, suffix, deltaPct, tone, trend, trendColor,
}: {
  label: string; value: string; suffix?: string; deltaPct?: number; tone: KpiDeltaTone;
  trend?: number[]; trendColor?: string;
}) {
  return (
    <Card variant="quiet" className="flex flex-col gap-2 min-h-[124px]">
      <span className="font-semibold text-[12px] leading-none tracking-[0.008em] text-[var(--w-fg-neutral)]">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-bold text-[24px] leading-[1.05] tracking-[-0.02em] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
          {value}
        </span>
        {suffix && <span className="font-semibold text-[13px] text-[var(--w-fg-neutral)]">{suffix}</span>}
      </div>
      <div className="flex items-center justify-between gap-2 min-h-[20px]">
        <DeltaChip deltaPct={deltaPct} tone={tone} />
      </div>
      {trend && <Sparkline data={trend} color={trendColor ?? "var(--w-primary-normal)"} fill height={24} />}
    </Card>
  );
}

// 2차 지표 — 컴팩트 표기(스파크라인 없음). min-height 로 빅 타일과 행 높이 통일.
function KpiTileCompact({
  label, value, suffix, deltaPct, tone,
}: {
  label: string; value: string; suffix?: string; deltaPct?: number; tone: KpiDeltaTone;
}) {
  return (
    <Card variant="quiet" className="flex flex-col justify-center gap-1.5 min-h-[124px]">
      <span className="font-semibold text-[12px] leading-none tracking-[0.008em] text-[var(--w-fg-neutral)]">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-bold text-[18px] leading-[1.1] tracking-[-0.01em] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
          {value}
        </span>
        {suffix && <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">{suffix}</span>}
      </div>
      <DeltaChip deltaPct={deltaPct} tone={tone} />
    </Card>
  );
}

function KpiStrip({
  loading, kpis, revenue, roasDeltaPct, conversion, todaySpend, todaySpendDeltaPct, spendTrend, impressionsTrend,
}: {
  loading: boolean;
  kpis: ReturnType<typeof derivePeriodKpis>;
  revenue: { value: number; deltaPct?: number };
  roasDeltaPct?: number;
  conversion: ReturnType<typeof deriveConversionSummary>;
  todaySpend?: number;
  todaySpendDeltaPct?: number;
  spendTrend?: number[];
  impressionsTrend?: number[];
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[124px] rounded-xl" />
          <Skeleton className="h-[124px] rounded-xl" />
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[124px] rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <KpiTileBig label="총 지출" value={fmtKRW(kpis.spend.value)} deltaPct={kpis.spend.deltaPct} tone="neutral" trend={spendTrend} trendColor="var(--w-data-muted)" />
        {conversion ? (
          <KpiTileBig
            label="ROAS"
            value={conversion.roas.toFixed(2)}
            suffix="x"
            deltaPct={roasDeltaPct}
            tone={roasDeltaPct != null ? deltaTone("roas", roasDeltaPct) : "neutral"}
          />
        ) : (
          <KpiTileBig label="노출" value={fmt(kpis.impressions.value)} deltaPct={kpis.impressions.deltaPct} tone="neutral" trend={impressionsTrend} trendColor="var(--w-data-muted)" />
        )}
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiTileCompact label="오늘 지출" value={todaySpend != null ? fmtKRW(todaySpend) : "—"} deltaPct={todaySpendDeltaPct} tone="neutral" />
        {conversion && <KpiTileCompact label="노출" value={fmt(kpis.impressions.value)} deltaPct={kpis.impressions.deltaPct} tone="neutral" />}
        <KpiTileCompact label="클릭" value={fmt(kpis.clicks.value)} deltaPct={kpis.clicks.deltaPct} tone={kpis.clicks.deltaPct != null ? deltaTone("clicks", kpis.clicks.deltaPct) : "neutral"} />
        <KpiTileCompact label="CTR" value={kpis.ctr.value.toFixed(2)} suffix="%" deltaPct={kpis.ctr.deltaPct} tone={kpis.ctr.deltaPct != null ? deltaTone("ctr", kpis.ctr.deltaPct) : "neutral"} />
        <KpiTileCompact label="CPC" value={fmtKRW(Math.round(kpis.cpc.value))} deltaPct={kpis.cpc.deltaPct} tone={kpis.cpc.deltaPct != null ? deltaTone("cpc", kpis.cpc.deltaPct) : "neutral"} />
        <KpiTileCompact label="CPM" value={fmtKRW(Math.round(kpis.cpm.value))} deltaPct={kpis.cpm.deltaPct} tone={kpis.cpm.deltaPct != null ? deltaTone("cpm", kpis.cpm.deltaPct) : "neutral"} />

        {conversion && (
          <>
            <KpiTileCompact label="전환수" value={fmt(conversion.conversionCount)} tone="neutral" />
            <KpiTileCompact
              label="전환매출"
              value={fmtKRW(revenue.value)}
              deltaPct={revenue.deltaPct}
              tone={revenue.deltaPct != null ? deltaTone("revenue", revenue.deltaPct) : "neutral"}
            />
            <KpiTileCompact label="CPA" value={fmtKRW(Math.round(conversion.cpa))} tone="neutral" />
          </>
        )}
      </div>
    </div>
  );
}

// ── 캠페인 성과 테이블 ─────────────────────────────────────────────────────────
const BASE_COLUMNS: { key: CampaignTableSortKey | null; label: string }[] = [
  { key: null, label: "캠페인명" },
  { key: null, label: "상태" },
  { key: "spend", label: "지출" },
  { key: "impressions", label: "노출" },
  { key: "clicks", label: "클릭" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "purchaseCount", label: "전환" },
  { key: "roas", label: "ROAS" },
];
const LANDING_COLUMN: { key: CampaignTableSortKey | null; label: string } = { key: "landingRate", label: "도착률" };

function CampaignTable({
  rows, total, sortKey, sortDir, onSort, onRowClick, onSeeAll, landingMeasuredCount, tableRef,
}: {
  rows: ReturnType<typeof toCampaignTableRow>[];
  total: number;
  sortKey: CampaignTableSortKey;
  sortDir: SortDir;
  onSort: (key: CampaignTableSortKey) => void;
  onRowClick: (id: string) => void;
  onSeeAll: () => void;
  landingMeasuredCount: number;
  tableRef: React.RefObject<HTMLDivElement | null>;
}) {
  // ADR-063 — 도착률 컬럼은 도착 측정 캠페인 ≥1 일 때만. 미명시 분모 = fake-funnel 위험이라 캡션에 N 명시.
  const showLanding = landingMeasuredCount > 0;
  const columns = showLanding ? [...BASE_COLUMNS, LANDING_COLUMN] : BASE_COLUMNS;

  return (
    <Card ref={tableRef}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">캠페인 성과</h2>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
            헤더를 눌러 정렬해요.{showLanding && ` 도착률은 측정된 ${landingMeasuredCount}개 기준이에요.`}
          </p>
        </div>
        {total > 5 && (
          <button type="button" onClick={onSeeAll} className="font-semibold text-[13px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] hover:underline">
            전체 보기 →
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center font-medium text-[13px] text-[var(--w-fg-alternative)]">표시할 캠페인이 없어요.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--w-line-normal)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => onSort(col.key!) : undefined}
                    className={cn(
                      "py-2.5 px-2 text-left font-semibold text-[12px] text-[var(--w-fg-neutral)] whitespace-nowrap select-none",
                      col.key && "cursor-pointer hover:text-[var(--w-fg-strong)]",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key === sortKey && <Icon name={sortDir === "asc" ? "trend-up" : "trend-down"} size={11} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onRowClick(r.id)}
                  className="border-b border-[var(--w-line-alternative)] last:border-b-0 cursor-pointer hover:bg-[var(--w-bg-alternative)]"
                >
                  <td className="py-2.5 px-2 font-semibold text-[13px] text-[var(--w-fg-strong)] max-w-[220px] truncate">{r.headline}</td>
                  <td className="py-2.5 px-2">
                    <Chip variant={CAMPAIGN_STATUS_MAP[r.status as keyof typeof CAMPAIGN_STATUS_MAP]?.chip ?? "neutral"} dot>{CAMPAIGN_STATUS_MAP[r.status as keyof typeof CAMPAIGN_STATUS_MAP]?.label ?? r.status}</Chip>
                  </td>
                  <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmtKRW(r.spend)}</td>
                  <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmt(r.impressions)}</td>
                  <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmt(r.clicks)}</td>
                  <td
                    className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)]"
                    style={{ color: r.ctr >= GOOD_CTR_PCT ? "var(--w-status-positive)" : "var(--w-fg-strong)" }}
                  >
                    {r.ctr.toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmtKRW(Math.round(r.cpc))}</td>
                  <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
                    {r.purchaseCount != null ? fmt(r.purchaseCount) : "—"}
                  </td>
                  <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
                    {r.roas != null ? `${r.roas.toFixed(2)}x` : "—"}
                  </td>
                  {showLanding && (
                    <td className="py-2.5 px-2 font-medium text-[13px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
                      {r.landingRate != null ? `${(r.landingRate * 100).toFixed(1)}%` : "측정 안 됨"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── 전환 경로 퍼널 (기존 재사용) ────────────────────────────────────────────────
function FunnelCard({
  loading, stages, hasData, onStageClick,
}: {
  loading: boolean;
  stages: FunnelStage[];
  hasData: boolean;
  onStageClick: (stageKey: FunnelStage["key"]) => void;
}) {
  return (
    <Card className="h-full">
      <div className="mb-4">
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">전환 경로</h2>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">노출에서 구매까지 어디서 새는지 단계별로 봐요. 단계를 누르면 캠페인 표가 해당 기준으로 정렬돼요.</p>
      </div>
      {loading ? (
        <Skeleton className="h-[200px] rounded-xl" />
      ) : !hasData ? (
        <div className="rounded-xl border border-dashed border-[var(--w-line-normal)] grid place-items-center text-center px-8" style={{ height: 200 }}>
          <div className="flex flex-col items-center gap-1.5">
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-neutral)]">전환 경로를 추적할 준비됐어요</div>
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)] max-w-[320px]">광고가 노출되기 시작하면 단계별 흐름이 여기 채워져요.</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((s) => <FunnelBar key={s.key} stage={s} onClick={s.key !== "impressions" && s.measured ? () => onStageClick(s.key) : undefined} />)}
        </div>
      )}
    </Card>
  );
}

function FunnelBar({ stage, onClick }: { stage: FunnelStage; onClick?: () => void }) {
  // sqrt 스케일 — 노출 대비 %가 선형이면 클릭/도착/구매 막대가 안 보일 만큼 눌린다(퍼널 특성상 항상 급감).
  const widthPct = Math.max(stage.value > 0 ? 4 : 0, Math.round(Math.sqrt(stage.pctOfImpressions) * 100));
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      aria-label={clickable ? `${stage.label} 단 기준으로 캠페인 표 정렬` : undefined}
      className={cn(
        "flex w-full flex-col gap-1 text-left rounded-lg -mx-1 px-1 py-0.5 bg-transparent border-0",
        clickable ? "cursor-pointer hover:bg-[var(--w-bg-alternative)]" : "cursor-default",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">{stage.label}</span>
        <div className="flex items-center gap-2">
          {stage.stepRate != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold text-[11px] leading-none px-1.5 py-1 rounded-full",
                stage.bigDrop
                  ? "bg-[var(--w-status-info-soft)] text-[var(--w-status-info)]"
                  : "text-[var(--w-fg-alternative)]",
              )}
            >
              {stage.bigDrop && <Icon name="trend-down" size={11} />}
              {Math.round(stage.stepRate * 100)}%
            </span>
          )}
          <span className="font-bold text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmt(stage.value)}</span>
        </div>
      </div>
      {stage.measured ? (
        <div className="h-2.5 rounded-full bg-[var(--w-bg-alternative)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--w-primary-normal)]" style={{ width: `${widthPct}%` }} />
        </div>
      ) : (
        <div className="h-2.5 rounded-full border border-dashed border-[var(--w-line-normal)]" />
      )}
      {stage.measured
        ? stage.denomLabel && <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">{stage.denomLabel}</span>
        : <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">아직 측정 안 됨</span>}
    </button>
  );
}

// ── 손익 카드 (ADR-060, 기존 재사용) ────────────────────────────────────────────
function ProfitCard({
  conversionValue, conversionSpend, roas, count, marginRate, onSaveMargin,
}: {
  conversionValue: number; conversionSpend: number; roas: number; count: number;
  marginRate: number | null; onSaveMargin: (rate: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(marginRate != null ? String(Math.round(marginRate * 100)) : "");
    setEditing(true);
  };
  const pct = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(pct) && pct > 0 && pct <= 100;
  const submit = () => {
    if (!valid) return;
    onSaveMargin(pct / 100);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="font-medium text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">평균 마진율 입력</div>
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
            className="w-20 px-2.5 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[18px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] text-right focus:outline-none focus:border-[var(--w-focus-ring)]"
          />
          <span className="font-bold text-[18px] text-[var(--w-fg-neutral)]">%</span>
        </div>
        <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]">
          광고비를 뺀 전 제품 평균 마진율이에요. 정확한 값이 아니어도 대략의 손익 방향을 볼 수 있어요.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" type="button" disabled={!valid} onClick={submit}>저장하고 손익 보기</Button>
          {marginRate != null && <Button variant="ghost" size="sm" type="button" onClick={() => setEditing(false)}>취소</Button>}
        </div>
      </Card>
    );
  }

  if (marginRate == null) {
    return (
      <Card variant="quiet" className="flex flex-col justify-between gap-3 bg-[var(--w-bg-alternative)]">
        <div>
          <div className="font-medium text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">공헌이익 · 손익</div>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-2">
            원가(마진율)를 넣으면 ROAS 너머 <span className="text-[var(--w-fg-strong)]">진짜 남는 이익</span>이 보여요.
          </p>
        </div>
        <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-[var(--w-primary-press)] hover:underline">
          마진율 넣기 <Icon name="arrow-right" size={13} />
        </button>
      </Card>
    );
  }

  const contribution = contributionMargin(conversionValue, conversionSpend, marginRate);
  const bep = bepRoas(marginRate);
  const profitable = (contribution ?? 0) >= 0;
  const bepHit = bep != null && roas >= bep;
  const tone = profitable ? "positive" : "negative";
  const marginRevenue = Math.round(conversionValue * marginRate);

  // ROAS 대 BEP ROAS 게이지 — 같은 축 위에서 현재 위치와 손익분기선을 한눈에 비교.
  const gaugeMax = Math.max(roas, bep ?? 0, 0.1) * 1.15;
  const roasPct = Math.min(100, (roas / gaugeMax) * 100);
  const bepPct = bep != null ? Math.min(100, (bep / gaugeMax) * 100) : null;

  return (
    <Card className="flex flex-col gap-1.5 border-transparent" style={{ background: `var(--w-status-${tone}-soft)` }}>
      <div className="font-medium text-[11px] leading-none uppercase tracking-[0.04em]" style={{ color: `var(--w-status-${tone})` }}>공헌이익 · 손익</div>
      <div className="font-bold text-[26px] leading-[1.1] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmtKRW(contribution ?? 0)}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <Icon name={bepHit ? "check-circle" : "warn"} size={14} style={{ color: `var(--w-status-${tone})` }} />
        <span className="font-semibold text-[13px] leading-none text-[var(--w-fg-neutral)]">
          {bepHit ? "손익분기 달성" : "손익분기 미달"} · BEP ROAS {bep?.toFixed(2)}x
        </span>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-[11px] leading-none text-[var(--w-fg-neutral)]">ROAS {roas.toFixed(2)}x</span>
          <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">손익분기 {bep?.toFixed(2)}x</span>
        </div>
        <div className="relative h-2 rounded-full bg-[var(--w-bg-elevated)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${roasPct}%`, background: `var(--w-status-${tone})` }} />
          {bepPct != null && (
            <div className="absolute top-0 bottom-0 w-[2px] bg-[var(--w-fg-strong)]" style={{ left: `${bepPct}%` }} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="rounded-lg bg-[var(--w-bg-elevated)] px-2.5 py-2">
          <div className="font-medium text-[10px] leading-none text-[var(--w-fg-alternative)]">마진 매출(추정)</div>
          <div className="font-bold text-[15px] leading-[1.4] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] mt-0.5">{fmtKRW(marginRevenue)}</div>
        </div>
        <div className="rounded-lg bg-[var(--w-bg-elevated)] px-2.5 py-2">
          <div className="font-medium text-[10px] leading-none text-[var(--w-fg-alternative)]">광고비</div>
          <div className="font-bold text-[15px] leading-[1.4] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] mt-0.5">{fmtKRW(conversionSpend)}</div>
        </div>
      </div>

      <div className="border-t border-[var(--w-line-normal)] mt-2.5 pt-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[11px] leading-[1.4] text-[var(--w-fg-alternative)]">
            전 제품 평균 마진 {Math.round(marginRate * 100)}% 가정 · 참고 ROAS {roas.toFixed(2)}x · 전환 캠페인 {count}개
          </span>
          <button type="button" onClick={startEdit} className="shrink-0 font-semibold text-[11px] text-[var(--w-primary-press)] hover:underline">수정</button>
        </div>
        <div className="flex items-start gap-1 font-medium text-[11px] leading-[1.4] text-[var(--w-fg-alternative)]">
          <Icon name="info" size={12} className="mt-px shrink-0" />
          <span>라스트클릭 기준이라 인지·상단 퍼널 기여는 빠져 있어요.</span>
        </div>
      </div>
    </Card>
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
