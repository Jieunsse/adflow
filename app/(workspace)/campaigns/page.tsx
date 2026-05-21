"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { fmt, fmtKRW, campaignDateInfo, campaignGradient } from "@shared/lib/format";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useToast } from "@shared/ui/Toast";
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
  issue: { label: "문제 있음", chip: "issue" },
};

type ControlParams = { campaignId: string; adSetId?: string; adId?: string; action: "pause" | "resume" | "set-daily-budget"; dailyBudget?: number };
type ControlResult = { ok: true };

function CampaignStatusChip({ status }: { status: string }) {
  const def = STATUS_DEF[status as StatusFilter] ?? { label: status, chip: "neutral" };
  return (
    <span className={`chip chip--${def.chip}`}>
      <span className="chip__dot" />
      {def.label}
    </span>
  );
}

const OBJECTIVE_CHIP_CLASS: Record<string, string> = {
  OUTCOME_TRAFFIC: "chip--obj-traffic",
  LINK_CLICKS: "chip--obj-traffic",
  OUTCOME_SALES: "chip--obj-conversion",
  CONVERSIONS: "chip--obj-conversion",
  OUTCOME_AWARENESS: "chip--obj-awareness",
  REACH: "chip--obj-awareness",
  OUTCOME_LEADS: "chip--obj-leads",
  OUTCOME_ENGAGEMENT: "chip--obj-engagement",
  OUTCOME_APP_PROMOTION: "chip--obj-install",
};

function CampaignObjectiveChip({ goal, objective }: { goal: string; objective: string }) {
  const cls = OBJECTIVE_CHIP_CLASS[objective] ?? "chip--neutral";
  return <span className={`chip ${cls}`}>{goal}</span>;
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

  const q = useQuery({ queryKey: ["campaigns", period], queryFn: () => fetchCampaigns(period) });
  const control = useApiMutation<ControlParams, ControlResult>("/api/campaign/control");
  const all = q.data ?? [];
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

  const goDetail = (id: string) => router.push(`/campaigns/${id}?period=${period}`);

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
    <div className="page" data-screen-label="캠페인">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>캠페인 관리</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>캠페인</h1>
          <p className="page__sub">집행 중인 캠페인을 한눈에 확인하고, 성과를 깊게 살펴보세요.</p>
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <button className="btn btn--primary" type="button" onClick={() => router.push("/create")}>
            <Icon name="plus" size={14} /> 새 캠페인 만들기
          </button>
        </div>
      </div>

      {isUnauthorized ? (
        <ErrorCard
          icon="link"
          title="광고 계정을 먼저 연결해주세요"
          reason="Meta 광고 계정과 페이지를 연결해야 캠페인을 불러올 수 있어요."
          ctaLabel="계정 연결로 가기"
          onAction={() => router.push("/setup")}
        />
      ) : q.isError ? (
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
            <SummaryItem label="게재 중" value={fmt(summary.live)} dot="#00bf40" />
            <SummaryItem label="검토 중" value={fmt(summary.review)} dot="#0066ff" />
            <SummaryItem label="노출 합" value={fmt(summary.impressions)} mono />
            <SummaryItem label="클릭 합" value={fmt(summary.clicks)} mono />
            <SummaryItem label="평균 CTR" value={summary.ctr.toFixed(2) + "%"} mono />
            <SummaryItem label="지출 합" value={fmtKRW(summary.spend)} mono last />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <div className="seg">
              <button type="button" className={period === "all" ? "on" : ""} onClick={() => setPeriod("all")}>전체</button>
              <button type="button" className={period === "7d" ? "on" : ""} onClick={() => setPeriod("7d")}>최근 7일</button>
              <button type="button" className={period === "30d" ? "on" : ""} onClick={() => setPeriod("30d")}>최근 30일</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(STATUS_DEF) as StatusFilter[]).map((k) => (
                <button key={k} type="button" onClick={() => setStatusFilter(k)} className={"filter-chip" + (statusFilter === k ? " filter-chip--on" : "")}>
                  {STATUS_DEF[k].label}
                  {statusFilter === k && k !== "all" && <Icon name="x" size={11} />}
                </button>
              ))}
            </div>
            <select className="select" style={{ width: 170, marginLeft: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="recent">최신순</option>
              <option value="spend">지출 많은 순</option>
              <option value="ctr-desc">CTR 높은 순</option>
              <option value="ctr-asc">CTR 낮은 순</option>
            </select>
            <div style={{ position: "relative", width: 240 }}>
              <Icon name="message" size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--w-fg-alternative)" }} />
              <input className="input" placeholder="캠페인 이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 34, height: 36 }} />
            </div>
          </div>

          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: 12, borderRadius: 12, background: "var(--w-fg-strong)", color: "var(--w-bg-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ font: "600 13px/1 var(--w-font-sans)" }}>{selected.size}개 선택됨</span>
                <span style={{ height: 14, width: 1, background: "rgba(255,255,255,0.18)" }} />
                <button className="btn-link" type="button" disabled={bulkPending} onClick={() => runBulk("pause")}><Icon name="pause" size={13} /> 일괄 일시정지</button>
                <button className="btn-link" type="button" disabled={bulkPending} onClick={() => runBulk("resume")}><Icon name="play" size={13} /> 일괄 재개</button>
                {bulkPending && <span style={{ font: "500 12px/1 var(--w-font-sans)", opacity: 0.7 }}>처리 중…</span>}
              </div>
              <button className="btn-link" type="button" onClick={clearSelection}>선택 해제</button>
            </div>
          )}

          {q.isLoading ? (
            <TableSkeleton />
          ) : all.length === 0 ? (
            <EmptyState
              icon={<Icon name="megaphone" size={26} />}
              title="아직 집행한 캠페인이 없어요"
              desc="AI가 만든 소재로 첫 광고를 시작해 보세요. 기간·예산만 정하면 바로 집행할 수 있어요."
              action={<button className="btn btn--primary" type="button" onClick={() => router.push("/create")}><Icon name="plus" size={14} /> 첫 캠페인 만들기</button>}
            />
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: "40px 32px", textAlign: "center", color: "var(--w-fg-neutral)" }}>
              조건에 맞는 캠페인이 없어요. 필터나 검색어를 바꿔 보세요.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><Checkbox checked={allVisibleSelected} onChange={toggleAll} /></th>
                    <th>캠페인</th>
                    <th style={{ width: 100, textAlign: "center" }}>목표</th>
                    <th style={{ width: 110, textAlign: "center" }}>상태</th>
                    <th style={{ width: 160, textAlign: "center" }}>기간</th>
                    <th style={{ width: 110, textAlign: "center" }}>일일예산</th>
                    <th style={{ width: 100, textAlign: "center" }}>노출</th>
                    <th style={{ width: 90, textAlign: "center" }}>클릭</th>
                    <th style={{ width: 80, textAlign: "center" }}>CTR</th>
                    <th style={{ width: 110, textAlign: "center" }}>지출</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isSel = selected.has(c.id);
                    const isMenu = menuOpen === c.id;
                    const { daysLine, progressLine } = campaignDateInfo(c.startDate, c.endDate, c.status);
                    return (
                      <tr key={c.id} className={"dtable__row" + (isSel ? " dtable__row--on" : "")}>
                        <td><Checkbox checked={isSel} onChange={() => toggleSelect(c.id)} /></td>
                        <td onClick={() => goDetail(c.id)} style={{ cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 8, background: campaignGradient(c.id), flex: "0 0 auto" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ font: "600 13.5px/1.35 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.headline}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}><CampaignObjectiveChip goal={c.goal} objective={c.objective} /></td>
                        <td style={{ textAlign: "center" }}><CampaignStatusChip status={c.status} /></td>
                        <td onClick={() => goDetail(c.id)} style={{ cursor: "pointer", textAlign: "center" }}>
                          <div style={{ font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{daysLine}</div>
                          <div style={{ font: "500 11px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)", marginTop: 4 }}>{progressLine}</div>
                        </td>
                        <td className="dtable__num" style={{ textAlign: "center" }}>{c.dailyBudget != null ? fmtKRW(c.dailyBudget) : "—"}</td>
                        <td className="dtable__num" style={{ textAlign: "center" }}>{c.impressions ? fmt(c.impressions) : "—"}</td>
                        <td className="dtable__num" style={{ textAlign: "center" }}>{c.clicks ? fmt(c.clicks) : "—"}</td>
                        <td className="dtable__num" style={{ textAlign: "center" }}>{c.ctr ? c.ctr.toFixed(2) + "%" : "—"}</td>
                        <td className="dtable__num" style={{ textAlign: "center" }}>{c.spend ? fmtKRW(c.spend) : "—"}</td>
                        <td data-menu-root style={{ position: "relative" }}>
                          <button className="icon-btn" type="button" title="더 보기" onClick={(e) => { e.stopPropagation(); setMenuOpen(isMenu ? null : c.id); setBudgetEdit(null); }}>
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
            </div>
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
    <div className="row-menu" onClick={(e) => e.stopPropagation()}>
      <MenuItem icon="arrow-right" onClick={onDetail}>상세 보기</MenuItem>
      <MenuItem icon={paused ? "play" : "pause"} onClick={onPauseResume} disabled={busy}>{busy ? "처리 중…" : paused ? "재개" : "일시정지"}</MenuItem>
      <MenuItem icon="wallet" onClick={onBudgetOpen}>일일예산 조정</MenuItem>
      <MenuItem icon="sparkles" onClick={onRemake}>새 소재로 다시 만들기</MenuItem>
      <div className="row-menu__divider" />
      <MenuItem icon="folder" disabled soon>보관</MenuItem>
      <MenuItem icon="copy" disabled soon>복제</MenuItem>
      <MenuItem icon="doc" disabled soon>이름 수정</MenuItem>
      {budgetOpen && (
        <div style={{ padding: 10, marginTop: 6, borderTop: "1px solid var(--w-line-alternative)" }}>
          <div style={{ font: "600 11px/1 var(--w-font-sans)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--w-fg-alternative)", marginBottom: 8 }}>일일예산 조정</div>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--w-line-normal)", borderRadius: 8, paddingLeft: 10, marginBottom: 6 }}>
            <span style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>₩</span>
            <input className="input" style={{ border: "none", paddingLeft: 6, height: 34, font: "600 13px/1 var(--w-font-mono)" }} value={budgetValue ? Number(budgetValue).toLocaleString("ko-KR") : ""} onChange={(e) => setBudgetValue(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
          </div>
          <div style={{ font: "500 11px/1.4 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginBottom: 8 }}>최소 ₩10,000</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => setBudgetValue("")}>지우기</button>
            <button className="btn btn--primary btn--sm" type="button" disabled={busy} onClick={onBudgetApply}>{busy ? "적용 중…" : "적용"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick, disabled, soon }: { icon: IconName; children: React.ReactNode; onClick?: () => void; disabled?: boolean; soon?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="row-menu__item">
      <Icon name={icon} size={14} />
      <span style={{ flex: 1 }}>{children}</span>
      {soon && <span style={{ font: "500 10px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)", padding: "3px 6px", background: "var(--w-bg-alternative)", borderRadius: 4 }}>곧 지원</span>}
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="dtable">
        <thead>
          <tr>
            <th style={{ width: 40 }} /><th>캠페인</th><th style={{ width: 100, textAlign: "center" }}>목표</th><th style={{ width: 110, textAlign: "center" }}>상태</th><th style={{ width: 160, textAlign: "center" }}>기간</th>
            <th style={{ width: 110, textAlign: "center" }}>일일예산</th><th style={{ width: 100, textAlign: "center" }}>노출</th>
            <th style={{ width: 90, textAlign: "center" }}>클릭</th><th style={{ width: 80, textAlign: "center" }}>CTR</th>
            <th style={{ width: 110, textAlign: "center" }}>지출</th><th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="dtable__row">
              <td><div className="skel" style={{ width: 18, height: 18, borderRadius: 5 }} /></td>
              <td><div style={{ display: "flex", gap: 12, alignItems: "center" }}><div className="skel" style={{ width: 38, height: 38, borderRadius: 8 }} /><div style={{ flex: 1 }}><div className="skel" style={{ height: 14, width: "70%", marginBottom: 6 }} /><div className="skel" style={{ height: 11, width: "40%" }} /></div></div></td>
              <td><div className="skel" style={{ height: 22, width: 60, borderRadius: 999, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 22, width: 70, borderRadius: 999, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: "80%", margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: 70, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: 60, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: 50, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: 50, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: 70, margin: "0 auto" }} /></td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorCard({ icon = "warn", title, reason, ctaLabel = "다시 시도", onAction }: { icon?: IconName; title: string; reason: string; ctaLabel?: string; onAction: () => void }) {
  return (
    <div className="card" style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name={icon} size={24} /></div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <button className="btn btn--secondary" type="button" style={{ marginTop: 8 }} onClick={onAction}>{ctaLabel}</button>
    </div>
  );
}
