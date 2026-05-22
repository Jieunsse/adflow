"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { EmptyState } from "@shared/ui/primitives";
import { cn } from "@shared/lib/cn";
import { campaignGradient } from "@shared/lib/format";
import { fetchCampaigns } from "@entities/campaign/api";
import type { CampaignSummary, CampaignIssueReason } from "@/lib/meta-ads";

type ApprovalsFilter = "all" | "review" | "issue";

const FILTER_LABEL: Record<ApprovalsFilter, string> = {
  all: "전체",
  review: "검토 중",
  issue: "이슈",
};

function sortPending(a: CampaignSummary, b: CampaignSummary): number {
  if (a.status !== b.status) return a.status === "issue" ? -1 : 1;
  const ta = a.startDate ? Date.parse(a.startDate) : 0;
  const tb = b.startDate ? Date.parse(b.startDate) : 0;
  return tb - ta;
}

const TH = "text-left px-[14px] py-3 font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]";
const TD = "px-[14px] py-[14px] border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle group-hover:bg-[var(--w-bg-neutral)]";

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
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="승인 대기">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">승인 대기</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>승인 대기</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">Meta 심사를 기다리는 캠페인과, 정책 이슈로 막힌 캠페인을 한곳에서 확인하세요.</p>
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <Button variant="secondary" type="button" onClick={() => q.refetch()} disabled={q.isFetching}>
            <Icon name="refresh" size={14} /> {q.isFetching ? "불러오는 중…" : "새로고침"}
          </Button>
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
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 py-[7px] px-3 rounded-full border font-semibold text-[12.5px] leading-none cursor-pointer transition-[background,color,border-color] duration-[120ms]",
                    filter === k
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)] hover:bg-[var(--w-fg-neutral)] hover:border-[var(--w-fg-neutral)]"
                      : "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] border-[var(--w-line-normal)] hover:bg-[var(--w-bg-neutral)]"
                  )}
                >
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
              action={<Button variant="primary" type="button" onClick={() => router.push("/create")}><Icon name="plus" size={14} /> 새 캠페인 만들기</Button>}
            />
          ) : filtered.length === 0 ? (
            <Card className="py-10 px-8 text-center text-[var(--w-fg-neutral)] font-medium text-[13px] leading-[1.5]">
              조건에 맞는 캠페인이 없어요. 필터를 바꿔 보세요.
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>캠페인</th>
                    <th className={TH} style={{ width: 100, textAlign: "center" }}>목표</th>
                    <th className={TH} style={{ width: 110, textAlign: "center" }}>상태</th>
                    <th className={TH} style={{ minWidth: 240 }}>사유</th>
                    <th className={TH} style={{ width: 120, textAlign: "center" }}>시작일</th>
                    <th className={TH} style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="group cursor-pointer" onClick={() => goDetail(c.id)}>
                      <td className={TD}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: campaignGradient(c.id), flex: "0 0 auto" }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ font: "600 13.5px/1.35 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.headline}</div>
                          </div>
                        </div>
                      </td>
                      <td className={TD} style={{ textAlign: "center" }}>
                        <ObjectiveChip goal={c.goal} objective={c.objective} />
                      </td>
                      <td className={TD} style={{ textAlign: "center" }}>
                        <StatusChip status={c.status} />
                      </td>
                      <td className={TD}>
                        <ReasonCell
                          status={c.status}
                          reason={c.issueReason}
                          onOpen={() => c.issueReason && setOpenReason({ campaignName: c.headline, reason: c.issueReason })}
                        />
                      </td>
                      <td className={TD} style={{ textAlign: "center", font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                        {c.startDate ?? "—"}
                      </td>
                      <td className={TD} style={{ color: "var(--w-fg-alternative)" }}>
                        <Icon name="arrow-right" size={14} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
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
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        style={{ flex: "0 0 auto" }}
      >
        자세히
      </Button>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const def: Record<string, { label: string; variant: ChipVariant }> = {
    review: { label: "검토 중", variant: "review" },
    issue: { label: "이슈", variant: "issue" },
  };
  const d = def[status] ?? { label: status, variant: "neutral" as ChipVariant };
  return <Chip variant={d.variant} dot>{d.label}</Chip>;
}

const OBJECTIVE_VARIANT: Record<string, ChipVariant> = {
  OUTCOME_TRAFFIC: "obj-traffic",
  LINK_CLICKS: "obj-traffic",
  OUTCOME_SALES: "obj-conversion",
  CONVERSIONS: "obj-conversion",
  OUTCOME_AWARENESS: "obj-awareness",
  REACH: "obj-awareness",
  OUTCOME_LEADS: "obj-leads",
  OUTCOME_ENGAGEMENT: "obj-engagement",
  OUTCOME_APP_PROMOTION: "obj-install",
};

function ObjectiveChip({ goal, objective }: { goal: string; objective: string }) {
  const variant = OBJECTIVE_VARIANT[objective] ?? "neutral";
  return <Chip variant={variant}>{goal}</Chip>;
}

function IssueReasonModal({ campaignName, reason, onClose }: { campaignName: string; reason: CampaignIssueReason; onClose: () => void }) {
  const showFullMessage = reason.message && reason.message !== reason.summary;
  return (
    <div className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]" onClick={onClose}>
      <div
        className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease]"
        style={{ width: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
          <Button variant="primary" type="button" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>캠페인</th>
            <th className={TH} style={{ width: 100, textAlign: "center" }}>목표</th>
            <th className={TH} style={{ width: 110, textAlign: "center" }}>상태</th>
            <th className={TH} style={{ minWidth: 240 }}>사유</th>
            <th className={TH} style={{ width: 120, textAlign: "center" }}>시작일</th>
            <th className={TH} style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i}>
              <td className={TD}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><Skeleton className="w-[38px] h-[38px] rounded-lg flex-none" /><div style={{ flex: 1 }}><Skeleton className="h-[14px] w-[60%]" /></div></div></td>
              <td className={TD}><Skeleton className="h-[22px] w-[60px] rounded-full mx-auto" /></td>
              <td className={TD}><Skeleton className="h-[22px] w-[70px] rounded-full mx-auto" /></td>
              <td className={TD}><Skeleton className="h-[14px] w-[70%]" /></td>
              <td className={TD}><Skeleton className="h-[14px] w-[70px] mx-auto" /></td>
              <td className={TD} />
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ErrorCard({ icon = "warn", title, reason, ctaLabel = "다시 시도", onAction }: { icon?: "warn" | "link"; title: string; reason: string; ctaLabel?: string; onAction: () => void }) {
  return (
    <Card className="py-10 px-8 flex flex-col items-center gap-3 text-center">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <Button variant="secondary" type="button" className="mt-2" onClick={onAction}>{ctaLabel}</Button>
    </Card>
  );
}
