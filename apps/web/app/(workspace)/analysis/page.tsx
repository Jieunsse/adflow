"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import DualChart, { ChartLegend } from "@shared/ui/DualChart";
import { fmt, fmtKRW, shortDate, campaignRunDays } from "@shared/lib/format";
import { fetchCampaigns } from "@entities/campaign/api";
import { CAMPAIGN_STATUS_MAP } from "@entities/campaign/status";
import { deriveConversionSummary, derivePeriodKpis, deriveRevenueRoasDelta, splitWindow, toCampaignTableRow } from "@entities/insights/period-kpis";
import { toCampaignsCsv } from "@entities/insights/report";
import { isFakePerformance } from "@entities/insights/fake-performance";
import type { AccountDailyPoint } from "@entities/insights/account-trend";
import type { CampaignSummary } from "@/lib/meta-ads";

type Period = "7d" | "30d";

async function fetchTrend(days: number): Promise<AccountDailyPoint[]> {
  const res = await fetch(`/api/dashboard/trend?days=${days}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.daily ?? []) as AccountDailyPoint[];
}

function downloadCsv(campaigns: CampaignSummary[]) {
  const blob = new Blob([toCampaignsCsv(campaigns.map(toCampaignTableRow))], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `광고성과_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricRow({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[var(--w-line-alternative)] last:border-b-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[var(--w-primary-normal)]" />
        <span className="w-label text-[var(--w-fg-normal)]">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="w-mono font-bold text-[var(--w-fg-strong)]">{value}</span>
        {delta != null && <span className={delta >= 0 ? "w-caption text-[var(--w-status-positive)]" : "w-caption text-[var(--w-status-negative)]"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</span>}
      </div>
    </div>
  );
}

function LiveAnalysisPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>("30d");
  const days = period === "30d" ? 30 : 7;
  const trendDays = days * 2;
  const enabled = !!session?.adAccountId || !!session?.browseMode;
  const campaignsQ = useQuery({ queryKey: ["campaigns", period], queryFn: () => fetchCampaigns(period), enabled, staleTime: 60_000 });
  const trendQ = useQuery({ queryKey: ["dashboard", "trend", trendDays], queryFn: () => fetchTrend(trendDays), enabled, staleTime: 60_000 });
  const campaigns = campaignsQ.data ?? [];
  const dailyAll = trendQ.data ?? [];

  const { current, previous } = useMemo(() => splitWindow(dailyAll, days), [dailyAll, days]);
  const kpis = useMemo(() => derivePeriodKpis(current, previous), [current, previous]);
  const conversion = useMemo(() => deriveConversionSummary(campaigns), [campaigns]);
  const revenueRoas = useMemo(() => deriveRevenueRoasDelta(current, previous), [current, previous]);
  const rows = useMemo(() => campaigns.map(toCampaignTableRow).sort((a, b) => b.spend - a.spend), [campaigns]);
  const totalDailyBudget = campaigns.reduce((sum, campaign) => sum + (campaign.dailyBudget ?? 0), 0);
  const warnings = useMemo(() => {
    const issues = campaigns.flatMap((campaign) => campaign.issueReason ? [{ campaign, text: campaign.issueReason.summary }] : []);
    const fake = campaigns.flatMap((campaign) => {
      if (campaign.linkClick == null) return [];
      const result = isFakePerformance(campaign, campaignRunDays(campaign.startDate, campaign.endDate));
      return result.fake && result.evidence ? [{ campaign, text: `클릭 대비 도착률이 ${result.evidence.landingRate}%예요.` }] : [];
    });
    return [...issues, ...fake].slice(0, 2);
  }, [campaigns]);

  const loading = campaignsQ.isLoading || trendQ.isLoading;
  const unauthorized = (campaignsQ.error as { code?: number } | null)?.code === 401;

  if (unauthorized) {
    return <Card className="max-w-[720px] mx-auto mt-12"><h1 className="w-h3 m-0">광고 계정을 먼저 연결해주세요</h1><p className="w-body mt-2 mb-0">상세 분석을 보려면 Meta 광고 계정과 페이지를 연결해야 해요.</p></Card>;
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto flex flex-col gap-5 px-8 py-8 pb-12" data-screen-label="상세 분석">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="w-h1 m-0">상세 분석</h1>
        <Button variant="secondary" size="sm" type="button" disabled={campaigns.length === 0} onClick={() => downloadCsv(campaigns)}><Icon name="upload" size={14} /> 내보내기</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["7d", "30d"] as Period[]).map((value) => (
          <button key={value} type="button" onClick={() => setPeriod(value)} className={value === period ? "h-9 px-3 rounded-lg border border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] w-label text-[var(--w-primary-press)]" : "h-9 px-3 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] w-label text-[var(--w-fg-normal)] hover:bg-[var(--w-bg-neutral)]"}>
            <Icon name="calendar" size={14} className="mr-1.5 align-[-2px]" />최근 {value === "7d" ? "7일" : "30일"}
          </button>
        ))}
        <span className="w-caption">계정 전체 · 구매 기준</span>
      </div>

      {loading ? (
        <Card><p className="w-body m-0">성과 데이터를 불러오고 있어요.</p></Card>
      ) : campaignsQ.isError ? (
        <Card><h2 className="w-h3 m-0">상세 분석을 불러오지 못했어요</h2><p className="w-body mt-2 mb-0">잠시 후 다시 시도해주세요.</p></Card>
      ) : campaigns.length === 0 ? (
        <Card><h2 className="w-h3 m-0">분석할 광고가 아직 없어요</h2><p className="w-body mt-2 mb-0">광고 게재가 시작되면 이 화면에서 성과 흐름을 볼 수 있어요.</p></Card>
      ) : (
        <>
          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="p-6 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div><h2 className="w-h4 m-0">광고비와 ROAS 추이</h2><p className="w-caption mt-1 mb-0">최근 {days}일 기준이에요.</p></div>
                  <div className="flex gap-3"><ChartLegend type="bar" color="var(--w-primary-normal)" label="광고비" /><ChartLegend type="line" color="var(--w-accent-violet)" label="ROAS" /></div>
                </div>
                {current.length > 0 ? <DualChart labels={current.map((point) => shortDate(point.date))} bars={current.map((point) => point.spend)} line={current.map((point) => point.spend > 0 ? point.purchaseValue / point.spend : 0)} lineFormat={(value) => `${value.toFixed(1)}x`} /> : <p className="w-body py-16 text-center">추이 데이터가 쌓이면 보여드려요.</p>}
              </div>
              <div className="p-6 border-t xl:border-t-0 xl:border-l border-[var(--w-line-normal)]">
                <MetricRow label="광고비" value={fmtKRW(kpis.spend.value)} delta={kpis.spend.deltaPct} />
                <MetricRow label="매출" value={fmtKRW(revenueRoas.revenue.value)} delta={revenueRoas.revenue.deltaPct} />
                <MetricRow label="ROAS" value={conversion ? `${conversion.roas.toFixed(2)}x` : "측정 전"} delta={revenueRoas.roasApprox} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--w-line-normal)]"><h2 className="w-h4 m-0">캠페인별 결과</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left min-w-[760px]">
                  <thead className="bg-[var(--w-bg-alternative)]"><tr className="w-caption"><th className="px-6 py-3 font-semibold">캠페인</th><th className="px-3 py-3 font-semibold text-right">광고비</th><th className="px-3 py-3 font-semibold text-right">클릭</th><th className="px-3 py-3 font-semibold text-right">구매</th><th className="px-3 py-3 font-semibold text-right">ROAS</th><th className="px-6 py-3 font-semibold text-right">CPA</th></tr></thead>
                  <tbody>{rows.slice(0, 6).map((row) => <tr key={row.id} className="border-t border-[var(--w-line-alternative)]"><td className="px-6 py-3"><div className="w-label truncate max-w-[250px]">{row.headline}</div><Chip variant={CAMPAIGN_STATUS_MAP[row.status as keyof typeof CAMPAIGN_STATUS_MAP]?.chip ?? "neutral"} size="sm">{CAMPAIGN_STATUS_MAP[row.status as keyof typeof CAMPAIGN_STATUS_MAP]?.label ?? row.status}</Chip></td><td className="px-3 py-3 text-right w-mono">{fmtKRW(row.spend)}</td><td className="px-3 py-3 text-right w-mono">{fmt(row.clicks)}</td><td className="px-3 py-3 text-right w-mono">{row.purchaseCount == null ? "—" : fmt(row.purchaseCount)}</td><td className="px-3 py-3 text-right w-mono text-[var(--w-status-positive)]">{row.roas == null ? "—" : `${row.roas.toFixed(2)}x`}</td><td className="px-6 py-3 text-right w-mono">{row.purchaseCount ? fmtKRW(row.spend / row.purchaseCount) : "—"}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>

            <div className="flex flex-col gap-5">
              <Card>
                <div className="flex items-center justify-between gap-3"><h2 className="w-h4 m-0">일 예산 현황</h2><Icon name="wallet" size={17} className="text-[var(--w-primary-normal)]" /></div>
                <dl className="mt-4 mb-0 grid grid-cols-[1fr_auto] gap-y-3 w-body"><dt>게재 중 캠페인</dt><dd className="m-0 w-mono font-bold">{fmt(campaigns.filter((campaign) => campaign.status === "live").length)}개</dd><dt>일 예산 합계</dt><dd className="m-0 w-mono font-bold">{totalDailyBudget ? fmtKRW(totalDailyBudget) : "설정 전"}</dd><dt>최근 {days}일 지출</dt><dd className="m-0 w-mono font-bold">{fmtKRW(kpis.spend.value)}</dd></dl>
              </Card>
              <Card>
                <div className="flex items-center gap-2"><Icon name={warnings.length ? "warn" : "check-circle"} size={17} className={warnings.length ? "text-[var(--w-status-cautionary)]" : "text-[var(--w-status-positive)]"} /><h2 className="w-h4 m-0">성과 점검</h2></div>
                {warnings.length ? <div className="mt-3 flex flex-col gap-2">{warnings.map(({ campaign, text }) => <div key={campaign.id} className="p-3 rounded-lg bg-[var(--w-bg-alternative)]"><div className="w-label">{campaign.headline}</div><p className="w-caption mt-1 mb-0">{text}</p></div>)}</div> : <p className="w-body mt-3 mb-0">지금 확인할 성과 이슈가 없어요.</p>}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const GREEN_CAMPAIGNS = [
  ["그린루틴_리타겟_30D", "₩58,320,000", "₩291,600,000", "1,458", "5.00", "₩39,985", "1.82%", "3.85%"],
  ["그린루틴_신규고객_7D", "₩54,210,000", "₩201,960,000", "1,062", "3.72", "₩51,072", "1.45%", "2.98%"],
  ["그린루틴_웰니스_관심사", "₩47,380,000", "₩165,830,000", "876", "3.50", "₩54,089", "1.28%", "2.78%"],
  ["그린루틴_장바구니_리마케팅", "₩43,150,000", "₩138,880,000", "642", "3.22", "₩67,213", "1.05%", "2.41%"],
  ["그린루틴_영상시청_95", "₩31,650,000", "₩96,480,000", "421", "3.05", "₩75,178", "1.05%", "2.11%"],
];

const GREEN_DEMOGRAPHICS = [
  ["18–24", "남성", "₩23,450,000", "₩88,900,000", "3.79", 55],
  ["18–24", "여성", "₩19,870,000", "₩78,120,000", "3.93", 44],
  ["25–34", "남성", "₩59,210,000", "₩228,390,000", "3.86", 61],
  ["25–34", "여성", "₩63,480,000", "₩274,980,000", "4.33", 46],
  ["35–44", "남성", "₩38,760,000", "₩168,930,000", "4.36", 64],
  ["35–44", "여성", "₩32,150,000", "₩137,520,000", "4.28", 48],
  ["45+", "남성", "₩26,440,000", "₩89,170,000", "3.37", 62],
  ["45+", "여성", "₩19,090,000", "₩64,700,000", "3.39", 47],
] as const;

const GREEN_WEEKDAY = [782, 856, 921, 988, 1032, 875, 734];
const GREEN_ROAS = [3.68, 3.92, 4.15, 4.45, 4.62, 4.09, 3.21];

function points(values: number[], width: number, height: number, max: number) {
  return values.map((value, index) => `${(index / (values.length - 1)) * width},${height - (value / max) * height}`).join(" ");
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 104;
  const height = 30;
  return <svg viewBox={`0 0 ${width} ${height}`} className="w-[104px] h-[30px] shrink-0" aria-hidden><polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points(values, width, height, Math.max(...values) * 1.1)} /></svg>;
}

function GreenTrendChart() {
  const spend = [7, 9, 6, 7, 8, 9, 8, 6, 7, 8, 7, 10, 12, 9, 7, 5, 6, 7, 8, 7, 6, 8, 9, 8, 6, 7, 8, 7];
  const revenue = [15, 21, 18, 15, 16, 21, 24, 21, 16, 18, 17, 19, 24, 20, 18, 18, 14, 13, 15, 20, 18, 17, 12, 10, 15, 19, 16, 13];
  const roas = [2.8, 4.1, 2.2, 1.8, 2.4, 3.2, 2.7, 1.9, 3.0, 2.4, 2.7, 2.0, 2.4, 2.7, 2.1, 2.9, 3.1, 2.6, 2.0, 4.7, 3.0, 2.4, 2.6, 2.5, 4.2, 4.4, 3.2, 2.4];
  const width = 700;
  const height = 190;
  const max = 30;
  return (
    <svg viewBox={`0 0 ${width} ${height + 28}`} className="w-full h-[250px]" role="img" aria-label="그린루틴 광고비, 매출, ROAS 추이">
      {[0, 1, 2, 3].map((index) => <line key={index} x1="0" x2={width} y1={(height / 3) * index} y2={(height / 3) * index} stroke="var(--w-line-alternative)" />)}
      <polyline fill="none" stroke="var(--w-primary-normal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points(spend, width, height, max)} />
      <polyline fill="none" stroke="var(--w-status-positive)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points(revenue, width, height, max)} />
      <polyline fill="none" stroke="var(--w-cyan-600)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points(roas.map((value) => value * 5), width, height, max)} />
      {[["04-24", 0], ["04-30", 6], ["05-06", 12], ["05-12", 18], ["05-18", 24], ["05-21", 27]].map(([label, index]) => <text key={String(label)} x={(Number(index) / 27) * width} y={height + 22} textAnchor="middle" fill="var(--w-fg-neutral)" fontSize="11" fontFamily="var(--w-font-sans)">{label}</text>)}
    </svg>
  );
}

function GreenWeekdayChart() {
  const width = 600;
  const height = 150;
  const max = 1200;
  const bar = 42;
  return (
    <svg viewBox={`0 0 ${width} ${height + 42}`} className="w-full h-[210px]" role="img" aria-label="그린루틴 요일별 구매와 ROAS">
      {[0, 1, 2, 3].map((index) => <line key={index} x1="0" x2={width} y1={(height / 3) * index} y2={(height / 3) * index} stroke="var(--w-line-alternative)" />)}
      {GREEN_WEEKDAY.map((value, index) => { const x = 42 + index * 82; const barHeight = (value / max) * height; return <rect key={index} x={x} y={height - barHeight} width={bar} height={barHeight} rx="4" fill="var(--w-primary-normal)" opacity="0.82" />; })}
      <polyline fill="none" stroke="var(--w-status-positive)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={GREEN_ROAS.map((value, index) => `${63 + index * 82},${height - (value / 6) * height}`).join(" ")} />
      {["월", "화", "수", "목", "금", "토", "일"].map((label, index) => <text key={label} x={63 + index * 82} y={height + 23} textAnchor="middle" fill="var(--w-fg-neutral)" fontSize="11" fontFamily="var(--w-font-sans)">{label}</text>)}
    </svg>
  );
}

function BrowseAnalysisPage() {
  return (
    <div className="w-full max-w-[1280px] mx-auto flex flex-col gap-4 px-6 py-6 pb-10" data-screen-label="상세 분석">
      <div className="flex items-center justify-between gap-4">
        <h1 className="w-h1 m-0">상세 분석</h1>
        <Button variant="secondary" size="sm" type="button"><Icon name="upload" size={14} /> 내보내기</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className="h-9 px-3 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] w-label text-[var(--w-fg-normal)]"><Icon name="calendar" size={14} className="mr-1.5 align-[-2px]" />최근 30일 <Icon name="chev-down" size={13} className="ml-1.5 align-[-2px]" /></button>
        <button type="button" className="h-9 px-3 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] w-label text-[var(--w-fg-normal)]"><Icon name="monitor" size={14} className="mr-1.5 align-[-2px]" />전체 게재위치 <Icon name="chev-down" size={13} className="ml-1.5 align-[-2px]" /></button>
        <button type="button" className="h-9 px-3 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] w-label text-[var(--w-fg-normal)]">전환 기준: 구매 <Icon name="chev-down" size={13} className="ml-1.5 align-[-2px]" /></button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="p-5 min-w-0">
            <h2 className="w-h4 m-0">광고비 · 매출 · ROAS 추이</h2>
            <div className="flex gap-4 mt-3"><ChartLegend type="line" color="var(--w-primary-normal)" label="광고비" /><ChartLegend type="line" color="var(--w-status-positive)" label="매출" /><ChartLegend type="line" color="var(--w-cyan-600)" label="ROAS" /></div>
            <GreenTrendChart />
          </section>
          <aside className="p-5 border-t xl:border-t-0 xl:border-l border-[var(--w-line-normal)] flex flex-col justify-center">
            <div className="flex flex-col gap-1"><div className="flex items-center gap-1.5 w-caption"><span className="w-2 h-2 rounded-full bg-[var(--w-primary-normal)]" />광고비</div><div className="flex items-center justify-between gap-3"><span className="w-mono text-[18px] font-bold">₩312,450,000</span><span className="w-caption text-[var(--w-status-positive)]">+8.6%</span></div><Sparkline values={[7, 12, 8, 10, 7, 9, 8, 12, 7, 10]} color="var(--w-primary-normal)" /></div>
            <div className="my-3 border-t border-[var(--w-line-alternative)]" />
            <div className="flex flex-col gap-1"><div className="flex items-center gap-1.5 w-caption"><span className="w-2 h-2 rounded-full bg-[var(--w-status-positive)]" />매출</div><div className="flex items-center justify-between gap-3"><span className="w-mono text-[18px] font-bold">₩1,248,750,000</span><span className="w-caption text-[var(--w-status-positive)]">+15.3%</span></div><Sparkline values={[9, 14, 11, 8, 13, 15, 10, 12, 8, 11]} color="var(--w-status-positive)" /></div>
            <div className="my-3 border-t border-[var(--w-line-alternative)]" />
            <div className="flex flex-col gap-1"><div className="flex items-center gap-1.5 w-caption"><span className="w-2 h-2 rounded-full bg-[var(--w-cyan-600)]" />ROAS</div><div className="flex items-center justify-between gap-3"><span className="w-mono text-[18px] font-bold">4.00</span><span className="w-caption text-[var(--w-status-positive)]">+26.2%</span></div><Sparkline values={[3, 4, 2, 3, 3, 5, 3, 4, 3, 4]} color="var(--w-cyan-600)" /></div>
          </aside>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-4 items-start">
        <Card className="p-0 overflow-hidden"><div className="px-5 py-4 border-b border-[var(--w-line-normal)]"><h2 className="w-h4 m-0">그린루틴 캠페인별 결과</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] border-collapse text-left"><thead className="bg-[var(--w-bg-alternative)]"><tr className="w-caption"><th className="px-5 py-3 font-semibold">캠페인</th><th className="px-2 py-3 font-semibold text-right">지출 금액</th><th className="px-2 py-3 font-semibold text-right">매출</th><th className="px-2 py-3 font-semibold text-right">구매</th><th className="px-2 py-3 font-semibold text-right">ROAS</th><th className="px-2 py-3 font-semibold text-right">CPA</th><th className="px-5 py-3 font-semibold text-right">CTR</th></tr></thead><tbody>{GREEN_CAMPAIGNS.map((row) => <tr key={row[0]} className="border-t border-[var(--w-line-alternative)]"><td className="px-5 py-3 w-label text-[var(--w-primary-press)]">{row[0]}</td><td className="px-2 py-3 text-right w-mono">{row[1]}</td><td className="px-2 py-3 text-right w-mono">{row[2]}</td><td className="px-2 py-3 text-right w-mono">{row[3]}</td><td className="px-2 py-3 text-right w-mono text-[var(--w-status-positive)]">{row[4]}</td><td className="px-2 py-3 text-right w-mono">{row[5]}</td><td className="px-5 py-3 text-right w-mono">{row[6]}</td></tr>)}<tr className="border-t border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)]"><td className="px-5 py-3 w-label">합계</td><td className="px-2 py-3 text-right w-mono font-bold">₩312,450,000</td><td className="px-2 py-3 text-right w-mono font-bold">₩1,248,750,000</td><td className="px-2 py-3 text-right w-mono font-bold">4,459</td><td className="px-2 py-3 text-right w-mono font-bold">4.00</td><td className="px-2 py-3 text-right w-mono font-bold">₩70,073</td><td className="px-5 py-3 text-right w-mono font-bold">1.41%</td></tr></tbody></table></div></Card>
        <div className="flex flex-col gap-4"><Card><div className="flex items-center justify-between"><h2 className="w-h4 m-0">예산 소진 현황</h2><span className="w-caption">그린루틴 전체</span></div><dl className="mt-4 mb-0 grid grid-cols-[1fr_auto] gap-y-3 w-body"><dt>총 예산</dt><dd className="m-0 w-mono">₩500,000,000</dd><dt>사용 금액</dt><dd className="m-0 w-mono">₩312,450,000 (62.5%)</dd></dl><div className="h-2 rounded-pill bg-[var(--w-fill-normal)] overflow-hidden mt-3"><div className="h-full w-[62.5%] bg-[var(--w-primary-normal)] rounded-pill" /></div><dl className="mt-4 mb-0 grid grid-cols-[1fr_auto] gap-y-3 w-body"><dt>남은 예산</dt><dd className="m-0 w-mono">₩187,550,000</dd><dt>예상 소진일</dt><dd className="m-0 w-mono">6일 후 (5월 27일)</dd></dl></Card><Card><div className="flex items-center gap-2"><Icon name="warn" size={17} className="text-[var(--w-status-cautionary)]" /><h2 className="w-h4 m-0">성과 경고</h2></div><div className="mt-3 flex flex-col gap-2"><div className="p-3 rounded-lg border border-[var(--w-status-cautionary-line)] bg-[var(--w-status-cautionary-soft)]"><p className="w-caption m-0"><strong className="w-label">그린루틴_신규고객_7D</strong>의 ROAS가 목표 3.0 아래예요.</p><button type="button" className="mt-1 p-0 border-none bg-transparent w-caption font-semibold text-[var(--w-primary-press)]">최적화 제안 보기 →</button></div><div className="p-3 rounded-lg bg-[var(--w-bg-alternative)]"><p className="w-caption m-0"><strong className="w-label">그린루틴_웰니스_관심사</strong>의 CPA가 지난 7일간 18% 올랐어요.</p><button type="button" className="mt-1 p-0 border-none bg-transparent w-caption font-semibold text-[var(--w-primary-press)]">자세히 보기 →</button></div></div></Card></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden"><div className="px-5 py-4 border-b border-[var(--w-line-normal)] flex items-center justify-between"><h2 className="w-h4 m-0">연령 · 성별 성과</h2><div className="flex gap-3"><ChartLegend type="bar" color="var(--w-primary-normal)" label="남성" /><ChartLegend type="bar" color="var(--w-status-positive)" label="여성" /></div></div><div className="px-5 py-2"><div className="grid grid-cols-[56px_42px_1fr_1fr_44px_1.4fr] gap-2 w-caption py-2"><span>연령</span><span>성별</span><span>지출 금액</span><span>매출</span><span>ROAS</span><span>비중</span></div>{GREEN_DEMOGRAPHICS.map((row) => <div key={`${row[0]}-${row[1]}`} className="grid grid-cols-[56px_42px_1fr_1fr_44px_1.4fr] gap-2 items-center border-t border-[var(--w-line-alternative)] py-2 w-caption"><span>{row[0]}</span><span>{row[1]}</span><span className="w-mono">{row[2]}</span><span className="w-mono">{row[3]}</span><span className="w-mono">{row[4]}</span><span className="h-4 flex overflow-hidden rounded-[4px] bg-[var(--w-fill-normal)]"><span className="h-full bg-[var(--w-primary-normal)]" style={{ width: `${row[5]}%` }} /><span className="h-full bg-[var(--w-status-positive)]" style={{ width: `${100 - row[5]}%` }} /></span></div>)}</div></Card>
        <Card className="p-0 overflow-hidden"><div className="px-5 py-4 border-b border-[var(--w-line-normal)] flex items-center justify-between"><h2 className="w-h4 m-0">요일별 구매</h2><div className="flex gap-3"><ChartLegend type="bar" color="var(--w-primary-normal)" label="구매 수" /><ChartLegend type="line" color="var(--w-status-positive)" label="ROAS" /></div></div><div className="px-5"><GreenWeekdayChart /><div className="grid grid-cols-7 border-t border-l border-[var(--w-line-alternative)] mb-5">{GREEN_WEEKDAY.map((value, index) => <div key={index} className="p-2 border-r border-b border-[var(--w-line-alternative)] text-center"><div className="w-caption">구매 수</div><div className="w-mono mt-1">{fmt(value)}</div></div>)}</div></div></Card>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const { data: session } = useSession();
  return session?.browseMode ? <BrowseAnalysisPage /> : <LiveAnalysisPage />;
}
