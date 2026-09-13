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
import type { AccountDailyPoint } from "@entities/insights/account-trend";
import { fetchAccountTrend, insightsKeys } from "@entities/insights/api";
import {
  splitWindow,
  derivePeriodKpis,
  deriveConversionSummary,
  deriveRevenueRoasDelta,
  toCampaignTableRow,
  type CampaignTableRow,
} from "@entities/insights/period-kpis";
import { deriveActionQueue, deriveHeroNarrative, type ActionButton, type ActionItem } from "@entities/insights/action-queue";
import { deriveAccountVerdict, deriveCampaignVerdicts, type AccountVerdictCampaign } from "@entities/insights/account-verdict";
import { buildRecent7Report, serializeReportText, toCampaignsCsv, type Recent7Report } from "@entities/insights/report";
import { listBrowse, BROWSE_CHANGE_EVENT } from "@entities/campaign/browse/store";
import { seedAutoPilotDemo } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import { campaignKeys, fetchCampaigns } from "@entities/campaign/api";
import { billingQueryKey, fetchBilling } from "@entities/billing/api";
import BillingAlertWidget from "@widgets/billing-alert";
import { DashboardHero, DashboardHeroNoConversion, heroRangeLabel } from "@widgets/dashboard-hero";
import { ActionQueue } from "@widgets/action-queue";
import type { CampaignSummary } from "@/lib/meta-ads";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import { useToast } from "@shared/ui/Toast";

type BrowseExample = "good" | "poor";
const REPORT_PERIOD = "7d";
const REPORT_TREND_DAYS = 14;
const REPORT_STORY = "최근 7일 성과";
const EMPTY_CAMPAIGNS: CampaignSummary[] = [];
const EMPTY_DAILY: AccountDailyPoint[] = [];

async function fetchDashboardCampaigns(example?: BrowseExample): Promise<CampaignSummary[]> {
  try {
    return await fetchCampaigns(REPORT_PERIOD, example);
  } catch (error) {
    if ((error as { code?: number }).code === 401) return [];
    throw error;
  }
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
  const browseMode = !!session?.browseMode;
  const [browseExample, setBrowseExample] = useState<BrowseExample>("good");

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
    queryKey: campaignKeys.list(REPORT_PERIOD, browseMode ? browseExample : undefined),
    queryFn: () => fetchDashboardCampaigns(browseMode ? browseExample : undefined),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 60_000,
  });

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

  const campaigns = campaignsQ.data ?? EMPTY_CAMPAIGNS;
  const customBrowseRows = useMemo(() => browseRows.filter((campaign) => !campaign.id.startsWith("browse_demo_")), [browseRows]);
  const allCampaigns = useMemo(() => browseMode ? [...customBrowseRows, ...campaigns] : campaigns, [browseMode, campaigns, customBrowseRows]);

  const trendQ = useQuery({
    queryKey: insightsKeys.accountTrend(REPORT_TREND_DAYS, browseMode ? browseExample : undefined),
    queryFn: () => fetchAccountTrend(REPORT_TREND_DAYS, browseMode ? browseExample : undefined),
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 5 * 60_000,
  });
  const dailyAll = trendQ.data ?? EMPTY_DAILY;

  const { current: dailyCurrent, previous: dailyPrevious } = useMemo(
    () => splitWindow(dailyAll, 7),
    [dailyAll],
  );

  const conversion = useMemo(() => deriveConversionSummary(campaigns), [campaigns]);
  const periodKpis = useMemo(() => derivePeriodKpis(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);
  const revenueRoas = useMemo(() => deriveRevenueRoasDelta(dailyCurrent, dailyPrevious), [dailyCurrent, dailyPrevious]);

  const narrative = useMemo(
    () =>
      deriveHeroNarrative({
        conversion,
        marginRate,
        clicksDeltaPct: periodKpis.clicks.deltaPct,
        cpcDeltaPct: periodKpis.cpc.deltaPct,
      }),
    [conversion, marginRate, periodKpis.clicks.deltaPct, periodKpis.cpc.deltaPct],
  );

  const actionItems = useMemo(() => {
    const items = deriveActionQueue({
        campaigns: allCampaigns,
        marginRate,
        totalSpend: periodKpis.spend.value,
        roasDeltaPct: revenueRoas.roasApprox,
      }).filter((item) => item.id.startsWith("pause-") || item.id.startsWith("bep-") || item.id === "coverage");
    return items.map((item): ActionItem => {
      const campaign = item.buttons.find((button) => button.target.kind === "campaign")?.target;
      return {
        ...item,
        title: item.id.startsWith("pause-") ? item.title.replace(" 광고를 지금 멈추세요", "의 성과를 확인해보세요") : item.title,
        body: item.id.startsWith("bep-") ? item.body.replace(/라, 지금 예산을 30% 올리면 공헌이익이 .*?더 나빠져요\./, "예요.") : item.body,
        buttons: [{ label: "상세 분석 보기", variant: "secondary", target: campaign?.kind === "campaign" ? campaign : { kind: "campaigns" } }],
      };
    });
  }, [allCampaigns, marginRate, periodKpis.spend.value, revenueRoas.roasApprox]);

  const report7dKpis = periodKpis;
  const report7dVerdict = useMemo(() => deriveAccountVerdict(campaigns.map(toVerdictCampaign)), [campaigns]);
  const report7dConversion = conversion;
  const report7dVerdicts = useMemo(() => deriveCampaignVerdicts(campaigns.map(toVerdictCampaign)), [campaigns]);
  const report7dRows = useMemo(() => allCampaigns.map(toCampaignTableRow), [allCampaigns]);
  const recent7Report: Recent7Report = useMemo(
    () =>
      buildRecent7Report({
        current: dailyCurrent,
        previous: dailyPrevious,
        kpis: report7dKpis,
        verdict: report7dVerdict,
        campaignRows: report7dRows,
        campaignVerdicts: report7dVerdicts,
        conversionValue: report7dConversion?.conversionValue,
        conversionSpend: report7dConversion?.conversionSpend,
        marginRate,
      }),
    [dailyCurrent, dailyPrevious, report7dKpis, report7dVerdict, report7dRows, report7dVerdicts, report7dConversion, marginRate],
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);

  const loading = campaignsQ.isLoading || trendQ.isLoading;

  const goMeasurement = () => router.push("/settings#measurement");
  const onAction = (b: ActionButton) => {
    const campaign = b.target.kind === "campaign" ? `&campaignId=${encodeURIComponent(b.target.id)}` : "";
    router.push(`/analysis?period=7d${campaign}`);
  };

  const rangeLabel = heroRangeLabel(dailyCurrent.map((d) => d.date));

  return (
    <div className="!mx-auto flex w-full !max-w-[1280px] flex-col gap-7 px-5 py-7 pb-12 sm:px-8 sm:py-8 lg:px-12 lg:py-9" data-screen-label="대시보드">
        <div className="flex justify-between items-center gap-4 min-h-11 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="w-h3 m-0">이번 주 광고 리포트</h1>
            {browseMode && <Chip variant="neutral" size="sm">{browseExample === "good" ? "좋은 예시" : "나쁜 예시"}</Chip>}
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
            {browseMode && (
              <SegControl
                value={browseExample}
                onChange={setBrowseExample}
                options={[{ value: "good", label: "좋은 예시" }, { value: "poor", label: "나쁜 예시" }]}
              />
            )}
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
                periodLabel={REPORT_STORY}
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
                periodLabel={REPORT_STORY}
                onMeasure={goMeasurement}
              />
            )}

            <ActionQueue loading={loading} items={actionItems} onAction={onAction} onViewAll={() => router.push("/analysis?period=7d")} />
          </>
        )}
    </div>
  );
}

function NextStepSlot({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center text-center gap-3 py-14 rounded-[var(--w-radius-20)]">
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
