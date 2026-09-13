"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { ChartLegend } from "@shared/ui/DualChart";
import { fmtKRW, shortDate, campaignRunDays } from "@shared/lib/format";
import { campaignKeys, fetchCampaigns } from "@entities/campaign/api";
import { fetchAnalysisTrend, insightsKeys } from "@entities/insights/api";
import { CAMPAIGN_STATUS_MAP } from "@entities/campaign/status";
import { deriveConversionSummary, derivePeriodKpis, deriveRevenueRoasDelta, splitWindow, toCampaignTableRow, type CampaignTableRow } from "@entities/insights/period-kpis";
import { toCampaignsCsv } from "@entities/insights/report";
import { isFakePerformance } from "@entities/insights/fake-performance";
import { useToast } from "@shared/ui/Toast";
import type { AccountDailyPoint } from "@entities/insights/account-trend";
import type { AnalysisCampaignMetrics, CampaignSummary } from "@/lib/meta-ads";

type Period = "7d" | "30d";
type Placement = "facebook" | "instagram";
type SortKey = "spend" | "revenue" | "roas" | "cpa";
type SortDir = "asc" | "desc";
type AnalysisRow = CampaignTableRow & { revenue: number | null; cpa: number | null };
const EMPTY_CAMPAIGNS: CampaignSummary[] = [];
const EMPTY_DAILY: AccountDailyPoint[] = [];

function downloadCsv(campaigns: CampaignSummary[]) {
  const blob = new Blob([toCampaignsCsv(campaigns.map(toCampaignTableRow))], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `광고성과_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function applyMetrics(campaign: CampaignSummary, metrics?: AnalysisCampaignMetrics): CampaignSummary {
  if (!metrics) return campaign;
  const roas = metrics.purchaseValue != null && metrics.spend > 0 ? metrics.purchaseValue / metrics.spend : undefined;
  return {
    ...campaign,
    spend: metrics.spend,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
    linkClick: metrics.linkClick,
    landingPageView: metrics.landingPageView,
    purchaseCount: metrics.purchaseCount,
    purchaseValue: metrics.purchaseValue,
    roas,
  };
}

function toAnalysisRow(campaign: CampaignSummary): AnalysisRow {
  const row = toCampaignTableRow(campaign);
  const revenue = row.isConversion ? campaign.purchaseValue ?? 0 : null;
  return { ...row, revenue, cpa: row.purchaseCount ? row.spend / row.purchaseCount : null };
}

function sortRows(rows: AnalysisRow[], key: SortKey, dir: SortDir): AnalysisRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => ((a[key] ?? -Infinity) - (b[key] ?? -Infinity)) * factor);
}

function MetricSummary({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="w-caption">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="w-h3 m-0 [font-variant-numeric:tabular-nums]">{value}</span>
        {delta != null && <span className={delta >= 0 ? "w-caption text-[var(--w-status-positive)]" : "w-caption text-[var(--w-status-negative)]"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</span>}
      </div>
    </div>
  );
}

function PerformanceTrendChart({ labels, spend, revenue, roas }: { labels: string[]; spend: number[]; revenue: number[]; roas: number[] }) {
  const width = 800;
  const height = 280;
  const padX = 52;
  const padRight = 48;
  const padTop = 24;
  const padBottom = 34;
  const innerWidth = width - padX - padRight;
  const innerHeight = height - padTop - padBottom;
  const count = labels.length;
  const maxCurrency = Math.max(...spend, ...revenue, 1) * 1.15;
  const maxRoas = Math.max(...roas, 0.1) * 1.15;
  const xOf = (index: number) => count === 1 ? width / 2 : padX + (innerWidth * index) / (count - 1);
  const line = (values: number[], max: number) => values.map((value, index) => `${index ? "L" : "M"}${xOf(index).toFixed(1)} ${(padTop + innerHeight - (value / max) * innerHeight).toFixed(1)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil((count - 1) / 5));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const tooltipWidth = 172;
  const tooltipHeight = 96;
  const tooltipX = hoverIndex == null
    ? 0
    : xOf(hoverIndex) > width - tooltipWidth - padRight
      ? xOf(hoverIndex) - tooltipWidth - 12
      : xOf(hoverIndex) + 12;
  const pointY = hoverIndex == null
    ? padTop
    : Math.min(
        padTop + innerHeight - (spend[hoverIndex] / maxCurrency) * innerHeight,
        padTop + innerHeight - (revenue[hoverIndex] / maxCurrency) * innerHeight,
        padTop + innerHeight - (roas[hoverIndex] / maxRoas) * innerHeight,
      );
  const tooltipY = Math.min(Math.max(pointY - tooltipHeight / 2, padTop), height - padBottom - tooltipHeight);
  const hoverLabel = hoverIndex == null ? "광고비, 매출, ROAS 추이" : `${labels[hoverIndex]}: 광고비 ${fmtKRW(spend[hoverIndex])}, 매출 ${fmtKRW(revenue[hoverIndex])}, ROAS ${roas[hoverIndex].toFixed(2)}배`;
  const currencyTick = (index: number) => fmtKRW(Math.round((maxCurrency / 3) * (3 - index)));
  const roasTick = (index: number) => `${((maxRoas / 3) * (3 - index)).toFixed(1)}x`;
  const selectPoint = (clientX: number, rect: DOMRect) => setHoverIndex(Math.max(0, Math.min(count - 1, Math.round(((clientX - rect.left) / rect.width) * (count - 1)))));

  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-[280px] cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--w-focus-ring)]" role="img" tabIndex={0} aria-label={hoverLabel} onPointerMove={(event) => selectPoint(event.clientX, event.currentTarget.getBoundingClientRect())} onPointerLeave={() => setHoverIndex(null)} onFocus={() => setHoverIndex(0)} onBlur={() => setHoverIndex(null)} onKeyDown={(event) => {
    if (event.key === "Escape") return setHoverIndex(null);
    if (event.key === "ArrowRight") { event.preventDefault(); return setHoverIndex((index) => Math.min(count - 1, (index ?? -1) + 1)); }
    if (event.key === "ArrowLeft") { event.preventDefault(); return setHoverIndex((index) => Math.max(0, (index ?? count) - 1)); }
  }}>
    <title>광고비, 매출, ROAS 추이</title>
    <desc>광고비와 매출은 같은 금액 축, ROAS는 별도 축으로 표시해 일별 흐름을 비교할 수 있어요.</desc>
    {[0, 1, 2, 3].map((index) => <g key={index}><line x1={padX} x2={width - padRight} y1={padTop + (innerHeight / 3) * index} y2={padTop + (innerHeight / 3) * index} stroke="var(--w-line-alternative)" /><text x={padX - 10} y={padTop + (innerHeight / 3) * index + 4} textAnchor="end" fill="var(--w-fg-neutral)" fontSize="10" style={{ fontFamily: "var(--w-font-mono)", fontWeight: 500 }}>{index === 3 ? "₩0" : currencyTick(index)}</text><text x={width - padRight + 10} y={padTop + (innerHeight / 3) * index + 4} fill="var(--w-fg-neutral)" fontSize="10" style={{ fontFamily: "var(--w-font-mono)", fontWeight: 500 }}>{index === 3 ? "0x" : roasTick(index)}</text></g>)}
    <path d={line(spend, maxCurrency)} fill="none" stroke="var(--w-primary-normal)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d={line(revenue, maxCurrency)} fill="none" stroke="var(--w-status-positive)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d={line(roas, maxRoas)} fill="none" stroke="var(--w-cyan-600)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    {hoverIndex != null && <><line x1={xOf(hoverIndex)} x2={xOf(hoverIndex)} y1={padTop} y2={padTop + innerHeight} stroke="var(--w-line-container)" strokeDasharray="3 3" /><circle cx={xOf(hoverIndex)} cy={padTop + innerHeight - (spend[hoverIndex] / maxCurrency) * innerHeight} r="4.5" fill="var(--w-common-100)" stroke="var(--w-primary-normal)" strokeWidth="2" /><circle cx={xOf(hoverIndex)} cy={padTop + innerHeight - (revenue[hoverIndex] / maxCurrency) * innerHeight} r="4.5" fill="var(--w-common-100)" stroke="var(--w-status-positive)" strokeWidth="2" /><circle cx={xOf(hoverIndex)} cy={padTop + innerHeight - (roas[hoverIndex] / maxRoas) * innerHeight} r="4.5" fill="var(--w-common-100)" stroke="var(--w-cyan-600)" strokeWidth="2" /><g transform={`translate(${tooltipX} ${tooltipY})`} pointerEvents="none"><rect width={tooltipWidth} height={tooltipHeight} rx="8" fill="var(--w-bg-elevated)" stroke="var(--w-line-normal)" /><text x="12" y="20" fill="var(--w-fg-strong)" fontSize="11" style={{ fontFamily: "var(--w-font-sans)", fontWeight: 600 }}>{labels[hoverIndex]}</text><text x="12" y="42" fill="var(--w-primary-normal)" fontSize="11" style={{ fontFamily: "var(--w-font-mono)" }}>광고비 {fmtKRW(spend[hoverIndex])}</text><text x="12" y="61" fill="var(--w-status-positive)" fontSize="11" style={{ fontFamily: "var(--w-font-mono)" }}>매출 {fmtKRW(revenue[hoverIndex])}</text><text x="12" y="80" fill="var(--w-cyan-600)" fontSize="11" style={{ fontFamily: "var(--w-font-mono)" }}>ROAS {roas[hoverIndex].toFixed(2)}x</text></g></>}
    {labels.map((label, index) => (index % labelEvery === 0 || index === count - 1) && <text key={label} x={xOf(index)} y={height - 8} textAnchor="middle" fill="var(--w-fg-neutral)" fontSize="11" style={{ fontFamily: "var(--w-font-sans)", fontWeight: 500 }}>{label}</text>)}
  </svg>;
}

export default function AnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const showToast = useToast();
  const period: Period = searchParams.get("period") === "7d" ? "7d" : "30d";
  const requestedCampaignId = searchParams.get("campaignId") ?? undefined;
  const requestedPlacement = searchParams.get("placement");
  const requestedPlacementValue: Placement | undefined = requestedPlacement === "facebook" || requestedPlacement === "instagram" ? requestedPlacement : undefined;
  const sort: SortKey = ["revenue", "roas", "cpa"].includes(searchParams.get("sort") ?? "") ? searchParams.get("sort") as SortKey : "spend";
  const dir: SortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const days = period === "7d" ? 7 : 30;
  const enabled = !!session?.adAccountId || !!session?.browseMode;
  const campaignsQ = useQuery({ queryKey: campaignKeys.list(period), queryFn: () => fetchCampaigns(period), enabled, staleTime: 60_000 });
  const campaigns = campaignsQ.data ?? EMPTY_CAMPAIGNS;
  const selectedCampaign = campaigns.find((campaign) => campaign.id === requestedCampaignId);
  const campaignId = selectedCampaign?.id;
  const trendQ = useQuery({
    queryKey: insightsKeys.analysisTrend(days * 2, campaignId, requestedPlacementValue),
    queryFn: () => fetchAnalysisTrend(days * 2, campaignId, requestedPlacementValue),
    enabled,
    staleTime: 60_000,
  });
  const trend = trendQ.data;
  const availablePlacements = trend?.placements ?? [];
  const placement = availablePlacements.includes(requestedPlacementValue as Placement) ? requestedPlacementValue : undefined;
  const metricsByCampaign = useMemo(() => new Map((trend?.campaignMetrics ?? []).map((metric) => [metric.id, metric])), [trend?.campaignMetrics]);
  const analyzedCampaigns = useMemo(() => {
    const scope = selectedCampaign ? [selectedCampaign] : campaigns;
    return scope
      .filter((campaign) => !placement || metricsByCampaign.has(campaign.id))
      .map((campaign) => applyMetrics(campaign, metricsByCampaign.get(campaign.id)));
  }, [campaigns, metricsByCampaign, placement, selectedCampaign]);
  const dailyAll = trend?.daily ?? EMPTY_DAILY;
  const { current, previous } = useMemo(() => splitWindow(dailyAll, days), [dailyAll, days]);
  const kpis = useMemo(() => derivePeriodKpis(current, previous), [current, previous]);
  const conversion = useMemo(() => deriveConversionSummary(analyzedCampaigns), [analyzedCampaigns]);
  const revenueRoas = useMemo(() => deriveRevenueRoasDelta(current, previous), [current, previous]);
  const rows = useMemo(() => sortRows(analyzedCampaigns.map(toAnalysisRow), sort, dir), [analyzedCampaigns, dir, sort]);
  const warnings = useMemo(() => {
    const issues = analyzedCampaigns.flatMap((campaign) => campaign.issueReason ? [{ campaign, text: campaign.issueReason.summary }] : []);
    const leaks = analyzedCampaigns.flatMap((campaign) => {
      if (campaign.linkClick == null) return [];
      const result = isFakePerformance(
        { impressions: campaign.impressions, ctr: campaign.ctr, linkClick: campaign.linkClick, landingPageView: campaign.landingPageView },
        campaignRunDays(campaign.startDate, campaign.endDate),
      );
      return result.fake && result.evidence ? [{ campaign, text: `클릭 대비 도착률이 ${result.evidence.landingRate}%예요.` }] : [];
    });
    return [...issues, ...leaks].slice(0, 3);
  }, [analyzedCampaigns]);
  const loading = campaignsQ.isLoading || trendQ.isLoading;
  const unauthorized = (campaignsQ.error as { code?: number } | null)?.code === 401;

  const updateParams = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(change).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    router.replace(`/analysis${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const updateSort = (nextSort: SortKey) => updateParams({ sort: nextSort, dir: sort === nextSort && dir === "desc" ? "asc" : "desc" });

  if (unauthorized) return <Card className="max-w-[720px] mx-auto mt-12"><h1 className="w-h3 m-0">광고 계정을 먼저 연결해주세요</h1><p className="w-body mt-2 mb-0">상세 분석을 보려면 Meta 광고 계정과 페이지를 연결해야 해요.</p></Card>;

  return (
    <div className="w-full max-w-[1280px] mx-auto flex flex-col gap-5 px-8 py-8 pb-12" data-screen-label="상세 분석">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="w-h1 m-0">상세 분석</h1><p className="w-body mt-1 mb-0">기간과 캠페인을 바꿔 성과 흐름을 비교해보세요.</p></div>
        <Button variant="secondary" size="sm" type="button" disabled={analyzedCampaigns.length === 0} onClick={() => { downloadCsv(analyzedCampaigns); showToast("현재 분석 범위의 광고 성과를 CSV로 내보냈어요."); }}><Icon name="upload" size={14} /> 내보내기</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SelectControl label="분석 기간" icon="calendar" value={period} onChange={(value) => updateParams({ period: value })} options={[{ value: "30d", label: "최근 30일" }, { value: "7d", label: "최근 7일" }]} />
        <SelectControl label="캠페인" icon="target" value={campaignId ?? "all"} onChange={(value) => updateParams({ campaignId: value === "all" ? undefined : value, placement: undefined })} options={[{ value: "all", label: "전체 캠페인" }, ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.headline }))]} />
        {availablePlacements.length > 0 && <SelectControl label="게재위치" icon="monitor" value={placement ?? "all"} onChange={(value) => updateParams({ placement: value === "all" ? undefined : value })} options={[{ value: "all", label: "전체 게재위치" }, ...availablePlacements.map((value) => ({ value, label: value === "facebook" ? "Facebook" : "Instagram" }))]} />}
        <span className="inline-flex h-9 items-center rounded-[var(--w-radius-8)] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3 w-label text-[var(--w-fg-normal)]">전환 기준: 구매</span>
      </div>

      {loading ? <Card><p className="w-body m-0">성과 데이터를 불러오고 있어요.</p></Card> : campaignsQ.isError || trendQ.isError ? <Card><h2 className="w-h3 m-0">상세 분석을 불러오지 못했어요</h2><p className="w-body mt-2 mb-0">잠시 후 다시 시도해주세요.</p></Card> : analyzedCampaigns.length === 0 ? <Card><h2 className="w-h3 m-0">분석할 광고가 아직 없어요</h2><p className="w-body mt-2 mb-0">광고 게재가 시작되면 이 화면에서 성과 흐름을 볼 수 있어요.</p></Card> : <>
        <Card className="p-0 overflow-hidden"><div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px]"><section className="p-6 min-w-0"><div className="flex items-center justify-between gap-3 flex-wrap"><div><h2 className="w-h4 m-0">광고비 · 매출 · ROAS 추이</h2><p className="w-caption mt-1 mb-0">최근 {days}일 기준이에요.</p></div><div className="flex gap-3"><ChartLegend type="line" color="var(--w-primary-normal)" label="광고비" /><ChartLegend type="line" color="var(--w-status-positive)" label="매출" /><ChartLegend type="line" color="var(--w-cyan-600)" label="ROAS" /></div></div>{current.length > 0 ? <PerformanceTrendChart labels={current.map((point) => shortDate(point.date))} spend={current.map((point) => point.spend)} revenue={current.map((point) => point.purchaseValue)} roas={current.map((point) => point.spend > 0 ? point.purchaseValue / point.spend : 0)} /> : <p className="w-body py-16 text-center">추이 데이터가 쌓이면 보여드려요.</p>}</section><aside className="flex flex-col justify-center gap-5 p-6 border-t xl:border-t-0 xl:border-l border-[var(--w-line-normal)]"><MetricSummary label="광고비" value={fmtKRW(kpis.spend.value)} delta={kpis.spend.deltaPct} /><MetricSummary label="매출" value={fmtKRW(revenueRoas.revenue.value)} delta={revenueRoas.revenue.deltaPct} /><MetricSummary label="ROAS" value={conversion ? `${conversion.roas.toFixed(2)}x` : "측정 전"} delta={revenueRoas.roasApprox} /></aside></div></Card>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-5 items-start"><Card className="p-0 overflow-hidden"><div className="px-6 py-4 border-b border-[var(--w-line-normal)]"><h2 className="w-h4 m-0">캠페인별 결과</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="bg-[var(--w-bg-alternative)]"><tr className="w-caption"><th className="px-6 py-3 font-semibold">캠페인</th><SortableHeader label="광고비" column="spend" active={sort} dir={dir} onClick={updateSort} /><SortableHeader label="매출" column="revenue" active={sort} dir={dir} onClick={updateSort} /><SortableHeader label="ROAS" column="roas" active={sort} dir={dir} onClick={updateSort} /><SortableHeader label="CPA" column="cpa" active={sort} dir={dir} onClick={updateSort} /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[var(--w-line-alternative)]"><td className="px-6 py-3"><button type="button" className="w-label text-left cursor-pointer border-0 bg-transparent p-0 text-[var(--w-primary-press)]" onClick={() => updateParams({ campaignId: row.id, placement: undefined })}>{row.headline}</button><Chip variant={CAMPAIGN_STATUS_MAP[row.status as keyof typeof CAMPAIGN_STATUS_MAP]?.chip ?? "neutral"} size="sm">{CAMPAIGN_STATUS_MAP[row.status as keyof typeof CAMPAIGN_STATUS_MAP]?.label ?? row.status}</Chip></td><td className="px-3 py-3 text-right w-mono">{fmtKRW(row.spend)}</td><td className="px-3 py-3 text-right w-mono">{row.revenue == null ? "—" : fmtKRW(row.revenue)}</td><td className="px-3 py-3 text-right w-mono text-[var(--w-status-positive)]">{row.roas == null ? "—" : `${row.roas.toFixed(2)}x`}</td><td className="px-6 py-3 text-right w-mono">{row.cpa == null ? "—" : fmtKRW(row.cpa)}</td></tr>)}</tbody></table></div></Card><Card><div className="flex items-center gap-2"><Icon name={warnings.length ? "warn" : "check-circle"} size={17} className={warnings.length ? "text-[var(--w-status-cautionary)]" : "text-[var(--w-status-positive)]"} /><h2 className="w-h4 m-0">진단</h2></div>{warnings.length ? <div className="mt-3 flex flex-col gap-2">{warnings.map(({ campaign, text }) => <div key={`${campaign.id}-${text}`} className="p-3 rounded-[var(--w-radius-8)] bg-[var(--w-bg-alternative)]"><div className="w-label">{campaign.headline}</div><p className="w-caption mt-1 mb-0">{text}</p></div>)}</div> : <p className="w-body mt-3 mb-0">현재 필터에서 확인할 성과 이슈가 없어요.</p>}</Card></div>
      </>}
    </div>
  );
}

function SelectControl({ label, icon, value, options, onChange }: { label: string; icon: "calendar" | "target" | "monitor"; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="inline-flex h-9 max-w-[260px] items-center rounded-[var(--w-radius-8)] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3 text-[var(--w-fg-normal)]"><Icon name={icon} size={14} className="mr-1.5 shrink-0" /><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-label min-w-0 flex-1 appearance-none truncate bg-transparent pr-1 outline-none">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Icon name="chev-down" size={13} className="shrink-0" /></label>;
}

function SortableHeader({ label, column, active, dir, onClick }: { label: string; column: SortKey; active: SortKey; dir: SortDir; onClick: (column: SortKey) => void }) {
  return <th className="px-3 py-3 text-right font-semibold"><button type="button" onClick={() => onClick(column)} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 w-caption font-semibold cursor-pointer">{label}{active === column && <Icon name={dir === "asc" ? "trend-up" : "trend-down"} size={12} />}</button></th>;
}
