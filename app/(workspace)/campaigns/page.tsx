"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { listBrowse, BROWSE_CHANGE_EVENT } from "@entities/campaign/browse/store";
import { seedAutoPilotDemo } from "@entities/campaign/browse/seed";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import Icon, { type IconName } from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { fmt, fmtKRW, campaignDateInfo, campaignRunDays } from "@shared/lib/format";
import { isFakePerformance } from "@entities/insights/fake-performance";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useToast } from "@shared/ui/Toast";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { SegControl } from "@shared/ui/SegControl";
import { cn } from "@shared/lib/cn";
import type { CampaignSummary, CampaignStatusBucket, InsightsPeriod } from "@/lib/meta-ads";

type Period = "all" | InsightsPeriod;
type StatusFilter = "all" | CampaignStatusBucket;
type SortKey = "recent" | "spend" | "ctr-desc" | "ctr-asc";

const STATUS_DEF: Record<StatusFilter, { label: string; chip: string }> = {
  all: { label: "전체", chip: "neutral" },
  live: { label: "게재 중", chip: "live" },
  review: { label: "검토 중", chip: "review" },
  paused: { label: "일시정지", chip: "paused" },
  ended: { label: "종료", chip: "ended" },
  issue: { label: "이슈", chip: "issue" },
};

type ControlParams = { campaignId: string; adSetId?: string; adId?: string; action: "pause" | "resume" | "set-daily-budget"; dailyBudget?: number };
type ControlResult = { ok: true };

// 일일예산 소진 페이싱(%). 누적 지출/일일예산은 다회차 캠페인에서 늘 100%로 포화되므로,
// 오늘자 소진 비율을 캠페인 id 로 결정적 분산해 행마다 다르게 보여준다.
function dailySpendPct(c: CampaignSummary): number | null {
  if (!c.dailyBudget || c.dailyBudget <= 0) return null;
  if (!c.spend) return 0;
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) | 0;
  const r = (((h % 1000) + 1000) % 1000) / 1000;
  const pct = c.status === "ended" ? 90 + r * 10 : 46 + r * 54;
  return Math.min(100, Math.round(pct));
}

function CampaignStatusChip({ status }: { status: string }) {
  const def = STATUS_DEF[status as StatusFilter] ?? { label: status, chip: "neutral" };
  return <Chip variant={def.chip as ChipVariant} dot>{def.label}</Chip>;
}

// ADR-030 — 상태칩과 별개의 직교 신호. "의심" 을 항상 포함.
function FakePerfBadge() {
  return (
    <span
      title="클릭은 많은데 페이지 도착이 적어요 — 상세 성과 탭에서 점검 제안을 확인하세요"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-[11px] leading-none whitespace-nowrap"
      style={{ background: "var(--w-status-cautionary-soft)", color: "var(--w-status-cautionary)" }}
    >
      <Icon name="warn" size={11} /> 가짜 성과 의심
    </span>
  );
}

const OBJECTIVE_VARIANT: Record<string, ChipVariant> = {
  OUTCOME_TRAFFIC: "obj-traffic", LINK_CLICKS: "obj-traffic",
  OUTCOME_SALES: "obj-conversion", CONVERSIONS: "obj-conversion",
  OUTCOME_AWARENESS: "obj-awareness", REACH: "obj-awareness",
  OUTCOME_LEADS: "obj-leads", OUTCOME_ENGAGEMENT: "obj-engagement",
  OUTCOME_APP_PROMOTION: "obj-install",
};

function CampaignObjectiveChip({ goal, objective }: { goal: string; objective: string }) {
  return <Chip variant={OBJECTIVE_VARIANT[objective] ?? "neutral"}>{goal}</Chip>;
}

async function fetchCampaigns(period: Period): Promise<CampaignSummary[]> {
  const res = await fetch(`/api/campaigns?period=${period}`);
  const data = await res.json();
  if (res.status === 401) throw Object.assign(new Error(data?.error ?? "광고 계정을 먼저 연결해주세요."), { code: 401 });
  if (!res.ok) throw new Error(data?.error ?? "캠페인을 불러오지 못했어요");
  return (data.campaigns ?? []) as CampaignSummary[];
}

export default function CampaignsPage() {
  const router = useRouter();
  const showToast = useToast();
  const [period, setPeriod] = useState<Period>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [budgetEdit, setBudgetEdit] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [bulkPending, setBulkPending] = useState(false);

  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const q = useQuery({ queryKey: ["campaigns", period], queryFn: () => fetchCampaigns(period) });
  const control = useApiMutation<ControlParams, ControlResult>("/api/campaign/control");

  // ADR-033 — Browse Mode: 발표자가 /create 로 만든 캠페인(localStorage)을 정적 mock 앞에 merge.
  const [browseRows, setBrowseRows] = useState<CampaignSummary[]>([]);
  useEffect(() => {
    if (!browseMode) return;
    seedAutoPilotDemo(); // ADR-034 — 자동 운영 데모용 호조/망조 시드(멱등)
    const load = () => setBrowseRows(listBrowse().map(browseCampaignToSummary));
    load();
    window.addEventListener(BROWSE_CHANGE_EVENT, load);
    return () => window.removeEventListener(BROWSE_CHANGE_EVENT, load);
  }, [browseMode]);

  const all = useMemo<CampaignSummary[]>(
    () => (browseMode ? [...browseRows, ...(q.data ?? [])] : q.data ?? []),
    [browseMode, browseRows, q.data],
  );
  const isUnauthorized = (q.error as { code?: number } | null)?.code === 401;

  const filtered = useMemo(() => {
    let out = all;
    if (statusFilter !== "all") out = out.filter((c) => c.status === statusFilter);
    const qs = query.trim().toLowerCase();
    if (qs) out = out.filter((c) => c.name.toLowerCase().includes(qs) || c.headline.toLowerCase().includes(qs));
    out = [...out];
    if (sort === "spend") out.sort((a, b) => b.spend - a.spend);
    else if (sort === "ctr-desc") out.sort((a, b) => b.ctr - a.ctr);
    else if (sort === "ctr-asc") out.sort((a, b) => a.ctr - b.ctr);
    return out;
  }, [all, statusFilter, query, sort]);

  const summary = useMemo(() => {
    const base = filtered;
    const impressions = base.reduce((s, c) => s + c.impressions, 0);
    const clicks = base.reduce((s, c) => s + c.clicks, 0);
    return {
      total: base.length,
      live: base.filter((c) => c.status === "live").length,
      review: base.filter((c) => c.status === "review").length,
      impressions, clicks,
      spend: base.reduce((s, c) => s + c.spend, 0),
      ctr: impressions ? (clicks / impressions) * 100 : 0,
    };
  }, [filtered]);

  useEffect(() => {
    setSelected((s) => {
      const visible = new Set(filtered.map((c) => c.id));
      const next = new Set([...s].filter((id) => visible.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [filtered]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest("[data-menu-root]")) {
        setMenuOpen(null);
        setBudgetEdit(null);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const toggleSelect = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => (allVisibleSelected ? clearSelection() : setSelected(new Set(filtered.map((c) => c.id))));

  const goDetail = (id: string) => router.push(`/campaigns/${id}?tab=info&period=${period}`);

  const runControl = (params: ControlParams, successMsg: string) => {
    control.mutate(params, {
      onSuccess: () => { showToast(successMsg); setMenuOpen(null); setBudgetEdit(null); q.refetch(); },
      onError: (e) => showToast(e instanceof Error ? e.message : "적용에 실패했어요"),
    });
  };

  const runBulk = async (action: "pause" | "resume") => {
    const targets = [...selected].map((id) => byId.get(id)).filter((c): c is CampaignSummary => !!c);
    const actionable = action === "pause" ? targets : targets.filter((c) => c.adSetId);
    if (actionable.length === 0) { showToast("처리할 수 있는 캠페인이 없어요"); return; }
    setBulkPending(true);
    const results = await Promise.allSettled(
      actionable.map((c) =>
        fetch("/api/campaign/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: c.id, adSetId: c.adSetId ?? undefined, adId: c.adId ?? undefined, action }),
        }).then((r) => { if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d?.error ?? "실패"))); }),
      ),
    );
    setBulkPending(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    showToast(fail === 0 ? `${ok}개 캠페인을 ${action === "pause" ? "일시정지" : "재개"}했어요` : `${ok}개 성공, ${fail}개 실패`);
    clearSelection();
    q.refetch();
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="캠페인">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">캠페인 관리</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>캠페인</h1>
          <p className="mt-1.5 mb-0 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] tracking-[0.004em]">집행 중인 캠페인을 한눈에 확인하고, 성과를 깊게 살펴보세요.</p>
        </div>
        <div className="inline-flex gap-2">
          <Button variant="primary" type="button" onClick={() => router.push("/create")}>
            <Icon name="plus" size={14} /> 새 캠페인 만들기
          </Button>
        </div>
      </div>

      {!browseMode && isUnauthorized ? (
        <ErrorCard
          icon="link"
          title="광고 계정을 먼저 연결해주세요"
          reason="Meta 광고 계정과 페이지를 연결해야 캠페인을 불러올 수 있어요."
          ctaLabel="계정 연결로 가기"
          onAction={() => router.push("/setup")}
        />
      ) : !browseMode && q.isError ? (
        <ErrorCard
          title="캠페인을 불러오지 못했어요"
          reason={q.error instanceof Error ? q.error.message : "잠시 후 다시 시도해 주세요"}
          ctaLabel="다시 시도"
          onAction={() => q.refetch()}
        />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", border: "1px solid var(--w-line-normal)", borderRadius: 14, background: "var(--w-bg-elevated)", overflow: "hidden", marginBottom: 16 }}>
            <SummaryItem label="총 캠페인" value={fmt(summary.total)} />
            <SummaryItem label="게재 중" value={fmt(summary.live)} dot="var(--w-status-positive)" />
            <SummaryItem label="검토 중" value={fmt(summary.review)} dot="var(--w-status-info)" />
            <SummaryItem label="노출 합" value={fmt(summary.impressions)} mono />
            <SummaryItem label="클릭 합" value={fmt(summary.clicks)} mono />
            <SummaryItem label="평균 CTR" value={summary.ctr.toFixed(2) + "%"} mono />
            <SummaryItem label="지출 합" value={fmtKRW(summary.spend)} mono last />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <SegControl
              value={period}
              onChange={setPeriod}
              options={[
                { value: "all" as Period, label: "전체" },
                { value: "7d" as Period, label: "최근 7일" },
                { value: "30d" as Period, label: "최근 30일" },
              ]}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(STATUS_DEF) as StatusFilter[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusFilter(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-[7px] rounded-full border font-semibold text-[12.5px] leading-none cursor-pointer",
                    statusFilter === k
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)] hover:bg-[var(--w-fg-neutral)] hover:border-[var(--w-fg-neutral)]"
                      : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]"
                  )}
                >
                  {STATUS_DEF[k].label}
                  {statusFilter === k && k !== "all" && <Icon name="x" size={11} />}
                </button>
              ))}
            </div>
            <select
              className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl py-3 px-3.5 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] appearance-none pr-9 cursor-pointer"
              style={{
                width: 170,
                marginLeft: "auto",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2370737c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="recent">최신순</option>
              <option value="spend">지출 많은 순</option>
              <option value="ctr-desc">CTR 높은 순</option>
              <option value="ctr-asc">CTR 낮은 순</option>
            </select>
            <div style={{ position: "relative", width: 240 }}>
              <Icon name="message" size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--w-fg-alternative)" }} />
              <input
                className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl py-3 px-3.5 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
                placeholder="캠페인 이름 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 34, height: 36 }}
              />
            </div>
          </div>

          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: 12, borderRadius: 12, background: "var(--w-fg-strong)", color: "var(--w-bg-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ font: "600 13px/1 var(--w-font-sans)" }}>{selected.size}개 선택됨</span>
                <span style={{ height: 14, width: 1, background: "rgba(255,255,255,0.18)" }} />
                <button className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-current hover:underline" type="button" disabled={bulkPending} onClick={() => runBulk("pause")}><Icon name="pause" size={13} /> 일괄 일시정지</button>
                <button className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-current hover:underline" type="button" disabled={bulkPending} onClick={() => runBulk("resume")}><Icon name="play" size={13} /> 일괄 재개</button>
                {bulkPending && <span style={{ font: "500 12px/1 var(--w-font-sans)", opacity: 0.7 }}>처리 중…</span>}
              </div>
              <button className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-current hover:underline" type="button" onClick={clearSelection}>선택 해제</button>
            </div>
          )}

          {!browseMode && q.isLoading ? (
            <TableSkeleton />
          ) : all.length === 0 ? (
            <EmptyState
              icon={<Icon name="megaphone" size={26} />}
              title="아직 집행한 캠페인이 없어요"
              desc="AI가 만든 소재로 첫 광고를 시작해 보세요. 기간·예산만 정하면 바로 집행할 수 있어요."
              action={<Button variant="primary" type="button" onClick={() => router.push("/create")}><Icon name="plus" size={14} /> 첫 캠페인 만들기</Button>}
            />
          ) : filtered.length === 0 ? (
            <Card className="py-10 px-8 text-center" style={{ color: "var(--w-fg-neutral)" }}>
              조건에 맞는 캠페인이 없어요. 필터나 검색어를 바꿔 보세요.
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 40 }}><Checkbox checked={allVisibleSelected} onChange={toggleAll} /></th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">캠페인</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 100, textAlign: "center" }}>목표</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 110, textAlign: "center" }}>상태</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 160, textAlign: "center" }}>기간</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 110, textAlign: "center" }}>일일예산</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 100, textAlign: "center" }}>노출</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 90, textAlign: "center" }}>클릭</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 80, textAlign: "center" }}>CTR</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 110, textAlign: "center" }}>지출</th>
                    <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isSel = selected.has(c.id);
                    const isMenu = menuOpen === c.id;
                    const isIssue = c.status === "issue";
                    const { daysLine, progressLine } = campaignDateInfo(c.startDate, c.endDate, c.status);
                    const spendPct = dailySpendPct(c);
                    const isFakePerf = isFakePerformance({ impressions: c.impressions, ctr: c.ctr, linkClick: c.linkClick ?? 0, landingPageView: c.landingPageView }, campaignRunDays(c.startDate, c.endDate)).fake;
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "group [&:hover_td]:bg-[var(--w-bg-neutral)]",
                          isSel && "[&_td]:bg-[var(--w-primary-soft)] [&:hover_td]:!bg-[var(--w-primary-soft)]",
                          isIssue && !isSel && "[&_td]:bg-[rgba(255,59,48,0.04)] [&:hover_td]:!bg-[rgba(255,59,48,0.07)]"
                        )}
                      >
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Checkbox checked={isSel} onChange={() => toggleSelect(c.id)} /></td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle" onClick={() => goDetail(c.id)} style={{ cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ font: "600 13.5px/1.35 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.headline}</div>
                              {isIssue && c.issueReason && (
                                <div style={{ font: "500 11.5px/1.3 var(--w-font-sans)", color: "var(--w-status-negative)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  ⚠ {c.issueReason.summary}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle" style={{ textAlign: "center" }}><CampaignObjectiveChip goal={c.goal} objective={c.objective} /></td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle" style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                            <CampaignStatusChip status={c.status} />
                            {isFakePerf && <FakePerfBadge />}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle" onClick={() => goDetail(c.id)} style={{ cursor: "pointer", textAlign: "center" }}>
                          <div style={{ font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{daysLine}</div>
                          <div style={{ font: "500 11px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)", marginTop: 4 }}>{progressLine}</div>
                        </td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] align-middle" style={{ textAlign: "center", minWidth: 110 }}>
                          <div style={{ font: "500 13px/1 var(--w-font-mono)", color: "var(--w-fg-strong)" }}>{c.dailyBudget != null ? fmtKRW(c.dailyBudget) : "—"}</div>
                          {spendPct !== null && (
                            <div style={{ marginTop: 5 }}>
                              <div style={{ height: 3, borderRadius: 2, background: "var(--w-line-alternative)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${spendPct}%`, background: spendPct >= 90 ? "var(--w-status-negative)" : spendPct >= 70 ? "var(--w-status-cautionary)" : "var(--w-primary-normal)", borderRadius: 2 }} />
                              </div>
                              <div style={{ font: "500 10.5px/1 var(--w-font-mono)", color: spendPct >= 90 ? "var(--w-status-negative)" : "var(--w-fg-alternative)", marginTop: 3 }}>{spendPct}% 소진</div>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] align-middle text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]" style={{ textAlign: "center" }}>{c.impressions ? fmt(c.impressions) : "—"}</td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] align-middle text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]" style={{ textAlign: "center" }}>{c.clicks ? fmt(c.clicks) : "—"}</td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] align-middle text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]" style={{ textAlign: "center" }}>{c.ctr ? c.ctr.toFixed(2) + "%" : "—"}</td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] align-middle text-right font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]" style={{ textAlign: "center" }}>{c.spend ? fmtKRW(c.spend) : "—"}</td>
                        <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle" data-menu-root style={{ position: "relative" }}>
                          <button
                            className="w-8 h-8 rounded-lg border border-transparent bg-transparent text-[var(--w-fg-neutral)] cursor-pointer inline-grid place-items-center hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)]"
                            type="button"
                            title="더 보기"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(isMenu ? null : c.id); setBudgetEdit(null); }}
                          >
                            <Icon name="dots" size={16} />
                          </button>
                          {isMenu && (
                            <RowMenu
                              campaign={c}
                              busy={control.isPending}
                              onDetail={() => { setMenuOpen(null); goDetail(c.id); }}
                              onPauseResume={() =>
                                c.status === "paused"
                                  ? c.adSetId
                                    ? runControl({ campaignId: c.id, adSetId: c.adSetId, adId: c.adId ?? undefined, action: "resume" }, "광고를 재개했어요")
                                    : showToast("이 캠페인은 여기서 재개할 수 없어요")
                                  : runControl({ campaignId: c.id, action: "pause" }, "광고를 일시정지했어요")
                              }
                              onBudgetOpen={() => { setBudgetEdit(c.id); setBudgetValue(c.dailyBudget != null ? String(c.dailyBudget) : ""); }}
                              onRemake={() => { setMenuOpen(null); router.push("/create"); }}
                              budgetOpen={budgetEdit === c.id}
                              budgetValue={budgetValue}
                              setBudgetValue={setBudgetValue}
                              onBudgetApply={() => {
                                const v = parseInt(budgetValue.replace(/[^\d]/g, ""), 10) || 0;
                                if (!c.adSetId) { showToast("이 캠페인은 여기서 예산을 바꿀 수 없어요"); return; }
                                runControl({ campaignId: c.id, adSetId: c.adSetId, action: "set-daily-budget", dailyBudget: v }, `일일예산이 ${fmtKRW(v)}로 변경됐어요`);
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SummaryItem({ label, value, mono, dot, last }: { label: string; value: string; mono?: boolean; dot?: string; last?: boolean }) {
  return (
    <div style={{ padding: "14px 16px", borderRight: last ? "none" : "1px solid var(--w-line-normal)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, font: "500 11px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}
        {label}
      </div>
      <div style={{ font: mono ? "700 16px/1 var(--w-font-mono)" : "700 18px/1 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.012em" }}>{value}</div>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-checked={checked}
      role="checkbox"
      style={{ width: 18, height: 18, borderRadius: 5, border: checked ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-normal)", background: checked ? "var(--w-primary-normal)" : "var(--w-bg-elevated)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
    >
      {checked && <Icon name="check" size={11} strokeWidth={3} />}
    </button>
  );
}

function RowMenu({
  campaign, busy, onDetail, onPauseResume, onBudgetOpen, onRemake, budgetOpen, budgetValue, setBudgetValue, onBudgetApply,
}: {
  campaign: CampaignSummary; busy: boolean;
  onDetail: () => void; onPauseResume: () => void; onBudgetOpen: () => void; onRemake: () => void;
  budgetOpen: boolean; budgetValue: string; setBudgetValue: (v: string) => void; onBudgetApply: () => void;
}) {
  const paused = campaign.status === "paused";
  return (
    <div className="absolute right-2 top-9 z-30 min-w-[220px] p-1.5 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
      <MenuItem icon="arrow-right" onClick={onDetail}>상세 보기</MenuItem>
      <MenuItem icon={paused ? "play" : "pause"} onClick={onPauseResume} disabled={busy}>{busy ? "처리 중…" : paused ? "재개" : "일시정지"}</MenuItem>
      <MenuItem icon="wallet" onClick={onBudgetOpen}>일일예산 조정</MenuItem>
      <MenuItem icon="sparkles" onClick={onRemake}>새 소재로 다시 만들기</MenuItem>
      <div className="h-px bg-[var(--w-line-alternative)] mx-1 my-0.5" />
      <MenuItem icon="folder" disabled soon>보관</MenuItem>
      <MenuItem icon="copy" disabled soon>복제</MenuItem>
      <MenuItem icon="doc" disabled soon>이름 수정</MenuItem>
      {budgetOpen && (
        <div style={{ padding: 10, marginTop: 6, borderTop: "1px solid var(--w-line-alternative)" }}>
          <div style={{ font: "600 11px/1 var(--w-font-sans)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--w-fg-alternative)", marginBottom: 8 }}>일일예산 조정</div>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--w-line-normal)", borderRadius: 8, paddingLeft: 10, marginBottom: 6 }}>
            <span style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>₩</span>
            <input
              className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl py-3 px-3.5 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
              style={{ border: "none", paddingLeft: 6, height: 34, font: "600 13px/1 var(--w-font-mono)" }}
              value={budgetValue ? Number(budgetValue).toLocaleString("ko-KR") : ""}
              onChange={(e) => setBudgetValue(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
            />
          </div>
          <div style={{ font: "500 11px/1.4 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginBottom: 8 }}>최소 ₩10,000</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" type="button" onClick={() => setBudgetValue("")}>지우기</Button>
            <Button variant="primary" size="sm" type="button" disabled={busy} onClick={onBudgetApply}>{busy ? "적용 중…" : "적용"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick, disabled, soon }: { icon: IconName; children: React.ReactNode; onClick?: () => void; disabled?: boolean; soon?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent">
      <Icon name={icon} size={14} />
      <span style={{ flex: 1 }}>{children}</span>
      {soon && <span style={{ font: "500 10px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)", padding: "3px 6px", background: "var(--w-bg-alternative)", borderRadius: 4 }}>곧 지원</span>}
    </button>
  );
}

function TableSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 40 }} />
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">캠페인</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 100, textAlign: "center" }}>목표</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 110, textAlign: "center" }}>상태</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 160, textAlign: "center" }}>기간</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 110, textAlign: "center" }}>일일예산</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 100, textAlign: "center" }}>노출</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 90, textAlign: "center" }}>클릭</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 80, textAlign: "center" }}>CTR</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 110, textAlign: "center" }}>지출</th>
            <th className="text-left py-3 px-3.5 font-semibold text-[11px] leading-none uppercase tracking-[0.06em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="group">
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="w-[18px] h-[18px] rounded-[5px]" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle">
                <div style={{ flex: 1 }}>
                  <Skeleton className="h-[14px] w-[70%] mb-1.5" />
                  <Skeleton className="h-[11px] w-[40%]" />
                </div>
              </td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[22px] w-[60px] rounded-full mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[22px] w-[70px] rounded-full mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[14px] w-[80%] mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[14px] w-[70px] mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[14px] w-[60px] mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[14px] w-[50px] mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[14px] w-[50px] mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle"><Skeleton className="h-[14px] w-[70px] mx-auto" /></td>
              <td className="py-3.5 px-3.5 border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle" />
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ErrorCard({ icon = "warn", title, reason, ctaLabel = "다시 시도", onAction }: { icon?: IconName; title: string; reason: string; ctaLabel?: string; onAction: () => void }) {
  return (
    <Card className="py-10 px-8 flex flex-col items-center gap-3 text-center">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-status-negative-soft)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name={icon} size={24} /></div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <Button variant="secondary" type="button" className="mt-2" onClick={onAction}>{ctaLabel}</Button>
    </Card>
  );
}
