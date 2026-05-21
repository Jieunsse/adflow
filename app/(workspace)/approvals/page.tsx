"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { campaignGradient } from "@shared/lib/format";
import { fetchCampaigns } from "@entities/campaign/api";
import type { CampaignSummary, CampaignIssueReason } from "@/lib/meta-ads";

type ApprovalsFilter = "all" | "review" | "issue";

const FILTER_LABEL: Record<ApprovalsFilter, string> = {
  all: "전체",
  review: "검토 중",
  issue: "이슈 발생",
};

function sortPending(a: CampaignSummary, b: CampaignSummary): number {
  if (a.status !== b.status) return a.status === "issue" ? -1 : 1;
  const ta = a.startDate ? Date.parse(a.startDate) : 0;
  const tb = b.startDate ? Date.parse(b.startDate) : 0;
  return tb - ta;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<ApprovalsFilter>("all");
  const [openReason, setOpenReason] = useState<{ campaignName: string; reason: CampaignIssueReason } | null>(null);

  const q = useQuery({ queryKey: ["campaigns", "all"], queryFn: () => fetchCampaigns("all") });
  const all = q.data ?? [];
  const isUnauthorized = (q.error as { code?: number } | null)?.code === 401;

  const pending = useMemo(() => all.filter((c) => c.status === "review" || c.status === "issue"), [all]);
  const counts = useMemo(() => ({
    all: pending.length,
    review: pending.filter((c) => c.status === "review").length,
    issue: pending.filter((c) => c.status === "issue").length,
  }), [pending]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? pending : pending.filter((c) => c.status === filter);
    return [...list].sort(sortPending);
  }, [pending, filter]);

  const goDetail = (id: string) => router.push(`/campaigns/${id}`);

  return (
    <div className="page" data-screen-label="승인 대기">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>승인 대기</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>승인 대기</h1>
          <p className="page__sub">Meta 심사를 기다리는 캠페인과, 정책 이슈로 막힌 캠페인을 한곳에서 확인하세요.</p>
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <button className="btn btn--secondary" type="button" onClick={() => q.refetch()} disabled={q.isFetching}>
            <Icon name="refresh" size={14} /> {q.isFetching ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </div>

      {isUnauthorized ? (
        <ErrorCard
          icon="link"
          title="광고 계정을 먼저 연결해주세요"
          reason="Meta 광고 계정과 페이지를 연결해야 심사 현황을 불러올 수 있어요."
          ctaLabel="계정 연결로 가기"
          onAction={() => router.push("/setup")}
        />
      ) : q.isError ? (
        <ErrorCard
          title="심사 현황을 불러오지 못했어요"
          reason={q.error instanceof Error ? q.error.message : "잠시 후 다시 시도해 주세요"}
          ctaLabel="다시 시도"
          onAction={() => q.refetch()}
        />
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(FILTER_LABEL) as ApprovalsFilter[]).map((k) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={"filter-chip" + (filter === k ? " filter-chip--on" : "")}>
                  {FILTER_LABEL[k]} <span style={{ color: filter === k ? "inherit" : "var(--w-fg-alternative)", marginLeft: 4 }}>{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>

          {q.isLoading ? (
            <TableSkeleton />
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<Icon name="check" size={26} />}
              title="대기 중인 캠페인이 없어요"
              desc="심사가 끝났거나 아직 검토 대상이 없어요. 새 캠페인을 만들면 여기서 진행 상황을 추적할 수 있어요."
              action={<button className="btn btn--primary" type="button" onClick={() => router.push("/create")}><Icon name="plus" size={14} /> 새 캠페인 만들기</button>}
            />
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: "40px 32px", textAlign: "center", color: "var(--w-fg-neutral)" }}>
              조건에 맞는 캠페인이 없어요. 필터를 바꿔 보세요.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th>캠페인</th>
                    <th style={{ width: 100, textAlign: "center" }}>목표</th>
                    <th style={{ width: 110, textAlign: "center" }}>상태</th>
                    <th style={{ minWidth: 240 }}>사유</th>
                    <th style={{ width: 120, textAlign: "center" }}>시작일</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="dtable__row" onClick={() => goDetail(c.id)} style={{ cursor: "pointer" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: campaignGradient(c.id), flex: "0 0 auto" }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ font: "600 13.5px/1.35 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.headline}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <ObjectiveChip goal={c.goal} objective={c.objective} />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <StatusChip status={c.status} />
                      </td>
                      <td>
                        <ReasonCell
                          status={c.status}
                          reason={c.issueReason}
                          onOpen={() => c.issueReason && setOpenReason({ campaignName: c.headline, reason: c.issueReason })}
                        />
                      </td>
                      <td style={{ textAlign: "center", font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                        {c.startDate ?? "—"}
                      </td>
                      <td style={{ color: "var(--w-fg-alternative)" }}>
                        <Icon name="arrow-right" size={14} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {openReason && (
        <IssueReasonModal
          campaignName={openReason.campaignName}
          reason={openReason.reason}
          onClose={() => setOpenReason(null)}
        />
      )}
    </div>
  );
}

function ReasonCell({ status, reason, onOpen }: { status: string; reason: CampaignIssueReason | null; onOpen: () => void }) {
  if (status === "review") {
    return <span style={{ font: "500 12.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}>심사 진행 중</span>;
  }
  if (!reason) {
    return <span style={{ font: "500 12.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}>사유 정보 없음</span>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        style={{ font: "500 12.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}
        title={reason.summary}
      >
        {reason.summary}
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        style={{ flex: "0 0 auto" }}
      >
        자세히
      </button>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const def: Record<string, { label: string; cls: string }> = {
    review: { label: "검토 중", cls: "chip--review" },
    issue: { label: "이슈 발생", cls: "chip--issue" },
  };
  const d = def[status] ?? { label: status, cls: "chip--neutral" };
  return (
    <span className={`chip ${d.cls}`}>
      <span className="chip__dot" />
      {d.label}
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

function ObjectiveChip({ goal, objective }: { goal: string; objective: string }) {
  const cls = OBJECTIVE_CHIP_CLASS[objective] ?? "chip--neutral";
  return <span className={`chip ${cls}`}>{goal}</span>;
}

function IssueReasonModal({ campaignName, reason, onClose }: { campaignName: string; reason: CampaignIssueReason; onClose: () => void }) {
  const showFullMessage = reason.message && reason.message !== reason.summary;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "26px 26px 8px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center", marginBottom: 14 }}>
            <Icon name="warn" size={20} />
          </div>
          <h3 style={{ font: "700 17px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em", margin: 0 }}>
            게재 거부 사유
          </h3>
          <div style={{ font: "500 12px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaignName}
          </div>
          <div style={{ font: "600 14px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: "16px 0 0" }}>
            {reason.summary}
          </div>
          {showFullMessage && (
            <div style={{ font: "500 13px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 0", whiteSpace: "pre-wrap" }}>
              {reason.message}
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--primary" type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="dtable">
        <thead>
          <tr>
            <th>캠페인</th>
            <th style={{ width: 100, textAlign: "center" }}>목표</th>
            <th style={{ width: 110, textAlign: "center" }}>상태</th>
            <th style={{ minWidth: 240 }}>사유</th>
            <th style={{ width: 120, textAlign: "center" }}>시작일</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i} className="dtable__row">
              <td><div style={{ display: "flex", gap: 12, alignItems: "center" }}><div className="skel" style={{ width: 38, height: 38, borderRadius: 8 }} /><div style={{ flex: 1 }}><div className="skel" style={{ height: 14, width: "60%" }} /></div></div></td>
              <td><div className="skel" style={{ height: 22, width: 60, borderRadius: 999, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 22, width: 70, borderRadius: 999, margin: "0 auto" }} /></td>
              <td><div className="skel" style={{ height: 14, width: "70%" }} /></td>
              <td><div className="skel" style={{ height: 14, width: 70, margin: "0 auto" }} /></td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorCard({ icon = "warn", title, reason, ctaLabel = "다시 시도", onAction }: { icon?: "warn" | "link"; title: string; reason: string; ctaLabel?: string; onAction: () => void }) {
  return (
    <div className="card" style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <button className="btn btn--secondary" type="button" style={{ marginTop: 8 }} onClick={onAction}>{ctaLabel}</button>
    </div>
  );
}
