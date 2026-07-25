"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { campaignGradient } from "@shared/lib/format";
import {
  getMember,
  getMemberActivity,
  type Member,
  type ReviewActivityItem,
} from "@/lib/mock-members";
import type { CampaignSummary } from "@/lib/meta-ads";

type ActivityTab = "created" | "launched" | "reviews";

const TAB_LABEL: Record<ActivityTab, string> = {
  created: "생성",
  launched: "게재",
  reviews: "검토",
};

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "팀장",
  launcher: "팀원·게재",
  reviewer: "팀원·검토",
};

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

const STATUS_CHIP: Record<string, { label: string; chip: ChipVariant }> = {
  live: { label: "게재 중", chip: "live" },
  review: { label: "검토 중", chip: "review" },
  paused: { label: "일시정지", chip: "paused" },
  ended: { label: "종료", chip: "ended" },
  issue: { label: "이슈", chip: "issue" },
};

const REVIEW_STATUS: Record<"pending" | "approved" | "rejected", { label: string; chip: ChipVariant }> = {
  pending: { label: "대기중", chip: "review" },
  approved: { label: "승인", chip: "live" },
  rejected: { label: "반려", chip: "issue" },
};

function roleChipClass(role: Member["role"]): string {
  const base = "inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full font-semibold text-[12px] leading-none tracking-[0.006em]";
  const colors: Record<Member["role"], string> = {
    owner: "bg-[rgba(101,65,242,0.12)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]",
    launcher: "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] dark:bg-[rgba(0,102,255,0.18)] dark:text-[#6ea7ff]",
    reviewer: "bg-[var(--w-bg-alternative)] text-[var(--w-fg-strong)] dark:bg-[rgba(255,255,255,0.06)]",
  };
  return `${base} ${colors[role]}`;
}

function roleDotClass(role: Member["role"]): string {
  const base = "w-1.5 h-1.5 rounded-full flex-none inline-block";
  const colors: Record<Member["role"], string> = {
    owner: "bg-[var(--w-accent-violet)]",
    launcher: "bg-[var(--w-primary-normal)]",
    reviewer: "bg-[var(--w-fg-alternative)]",
  };
  return `${base} ${colors[role]}`;
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const memberId = params.id;
  const member = getMember(memberId);
  const [tab, setTab] = useState<ActivityTab>("created");

  const activity = useMemo(() => getMemberActivity(memberId), [memberId]);

  if (!member) {
    return (
      <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="구성원 활동">
        <BackLink onClick={() => router.push("/members")} />
        <EmptyState
          icon={<Icon name="users" size={26} />}
          title="멤버를 찾을 수 없어요"
          desc="삭제됐거나 잘못된 주소일 수 있어요."
          action={
            <Button variant="secondary" type="button" onClick={() => router.push("/members")}>
              구성원 목록으로
            </Button>
          }
        />
      </div>
    );
  }

  const isInvited = member.status === "invited";

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="구성원 활동">
      <BackLink onClick={() => router.push("/members")} />

      <header style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: 4, marginBottom: 24 }}>
        <BigAvatar member={member} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">구성원 활동</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            <h1 className="m-0 mt-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">
              {member.name ?? "(이름 없음)"}
            </h1>
            <span className={roleChipClass(member.role)}>
              <span className={roleDotClass(member.role)} />
              {ROLE_LABEL[member.role]}
            </span>
            {isInvited && (
              <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] bg-transparent border border-dashed border-[var(--w-line-normal)]">
                <Icon name="clock" size={11} /> 초대됨
              </span>
            )}
          </div>
          <div className="font-medium text-[13px] leading-[1.5] [font-family:var(--w-font-mono)] text-[var(--w-fg-neutral)] mt-1.5">
            {member.email}
          </div>
          {!isInvited && (
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)] mt-1">
              {member.joined} 합류 · {member.lastActive} 활동
            </div>
          )}
        </div>
      </header>

      {isInvited ? (
        <EmptyState
          icon={<Icon name="clock" size={26} />}
          title="아직 합류 전이라 활동이 없어요"
          desc="초대 메일의 링크에서 Google 로그인하면 합류해요. 합류 후 만든 캠페인·검토 요청이 여기에 모여요."
          action={
            <Button variant="secondary" type="button" onClick={() => router.push("/members")}>
              구성원 목록으로
            </Button>
          }
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {(Object.keys(TAB_LABEL) as ActivityTab[]).map((k) => {
              const count =
                k === "created" ? activity.created.length :
                k === "launched" ? activity.launched.length :
                activity.reviews.length;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 py-[7px] px-3 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] font-semibold text-[13px] leading-none cursor-pointer hover:bg-[var(--w-bg-neutral)] transition-[background,color,border-color] duration-[120ms]",
                    tab === k && "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)] hover:bg-[var(--w-fg-neutral)] hover:border-[var(--w-fg-neutral)]"
                  )}
                >
                  {TAB_LABEL[k]}
                  <span className="font-semibold text-[11px] leading-none [font-family:var(--w-font-mono)] ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {tab === "created" && (
            <CampaignTabList
              kind="created"
              memberName={member.name ?? member.email}
              rows={activity.created}
              onSwitchTab={setTab}
              onRowClick={(id) => router.push(`/campaigns/${id}`)}
            />
          )}
          {tab === "launched" && (
            <CampaignTabList
              kind="launched"
              memberName={member.name ?? member.email}
              rows={activity.launched}
              onSwitchTab={setTab}
              onRowClick={(id) => router.push(`/campaigns/${id}`)}
            />
          )}
          {tab === "reviews" && (
            <ReviewTabList
              memberName={member.name ?? member.email}
              rows={activity.reviews}
              onSwitchTab={setTab}
              onRowClick={(id) => router.push(`/campaigns/${id}`)}
            />
          )}
        </>
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[13px] leading-none text-[var(--w-fg-neutral)] hover:underline mb-1"
    >
      <Icon name="arrow-left" size={13} /> 구성원
    </button>
  );
}

function BigAvatar({ member }: { member: Member }) {
  if (member.status === "invited") {
    return (
      <div className="w-14 h-14 rounded-full border-[1.5px] border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] grid place-items-center flex-none">
        <Icon name="message" size={22} />
      </div>
    );
  }
  return (
    <div
      className="w-14 h-14 rounded-full text-white grid place-items-center font-bold text-[22px] leading-none [font-family:var(--w-font-display)] flex-none"
      style={{ background: member.avatarBg || "var(--w-fg-neutral)" }}
    >
      {member.name?.[0] ?? "?"}
    </div>
  );
}

function CampaignTabList({
  kind, memberName, rows, onSwitchTab, onRowClick,
}: {
  kind: "created" | "launched";
  memberName: string;
  rows: CampaignSummary[];
  onSwitchTab: (tab: ActivityTab) => void;
  onRowClick: (campaignId: string) => void;
}) {
  if (rows.length === 0) {
    const verb = kind === "created" ? "만든" : "게재한";
    return (
      <EmptyState
        icon={<Icon name="folder" size={26} />}
        title={`${memberName}님이 ${verb} 캠페인이 없어요`}
        desc="다른 활동 탭에서 이 멤버의 캠페인·검토 내역을 확인해보세요."
        action={
          <div style={{ display: "inline-flex", gap: 8 }}>
            {kind !== "created" && (
              <Button variant="ghost" type="button" onClick={() => onSwitchTab("created")}>생성 탭으로</Button>
            )}
            <Button variant="ghost" type="button" onClick={() => onSwitchTab("reviews")}>검토 탭으로</Button>
          </div>
        }
      />
    );
  }
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left">캠페인</th>
            <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-center" style={{ width: 110 }}>목표</th>
            <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-center" style={{ width: 120 }}>상태</th>
            <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-center" style={{ width: 120 }}>{kind === "created" ? "생성일" : "게재일"}</th>
            <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="group cursor-pointer" onClick={() => onRowClick(c.id)}>
              <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)]">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: campaignGradient(c.id), flex: "0 0 auto" }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="font-semibold text-[14px] leading-[1.35] text-[var(--w-fg-strong)] overflow-hidden text-ellipsis whitespace-nowrap">
                      {c.headline}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-center">
                <Chip variant={OBJECTIVE_VARIANT[c.objective] ?? "neutral"}>{c.goal}</Chip>
              </td>
              <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-center">
                <CampaignStatusChip status={c.status} />
              </td>
              <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-center font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
                {c.startDate ?? "—"}
              </td>
              <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-[var(--w-fg-alternative)]">
                <Icon name="arrow-right" size={14} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ReviewTabList({
  memberName, rows, onSwitchTab, onRowClick,
}: {
  memberName: string;
  rows: ReviewActivityItem[];
  onSwitchTab: (tab: ActivityTab) => void;
  onRowClick: (campaignId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="users" size={26} />}
        title={`${memberName}님의 검토 내역이 없어요`}
        desc="검토 요청을 보내거나 받은 적이 없어요. 다른 탭에서 생성·게재 내역을 확인해보세요."
        action={
          <Button variant="ghost" type="button" onClick={() => onSwitchTab("created")}>생성 탭으로</Button>
        }
      />
    );
  }

  const outgoingCount = rows.filter((r) => r.direction === "outgoing").length;
  const incomingCount = rows.length - outgoingCount;

  return (
    <>
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mb-2.5">
        보낸 요청 <strong style={{ color: "var(--w-fg-strong)" }}>{outgoingCount}</strong>건 · 받은 요청 <strong style={{ color: "var(--w-fg-strong)" }}>{incomingCount}</strong>건
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-center" style={{ width: 44 }} />
              <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left">캠페인</th>
              <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 180 }}>상대</th>
              <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-center" style={{ width: 100 }}>상태</th>
              <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-center" style={{ width: 110 }}>요청일</th>
              <th className="px-4 py-2.5 font-semibold text-[12px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const { request, campaign, direction, counterpart } = item;
              const isOut = direction === "outgoing";
              return (
                <tr key={request.id} className="group cursor-pointer" onClick={() => onRowClick(campaign.id)}>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-center" style={{ color: isOut ? "var(--w-primary-press)" : "var(--w-fg-alternative)" }}>
                    <Icon name={isOut ? "arrow-right" : "arrow-left"} size={16} />
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)]">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: campaignGradient(campaign.id), flex: "0 0 auto" }} />
                      <div style={{ minWidth: 0 }}>
                        <div className="font-semibold text-[13px] leading-[1.35] text-[var(--w-fg-strong)] overflow-hidden text-ellipsis whitespace-nowrap">
                          {campaign.headline}
                        </div>
                        {request.status === "rejected" && request.comment && (
                          <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)] mt-1 overflow-hidden text-ellipsis whitespace-nowrap" title={request.comment}>
                            반려 사유: {request.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)]">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CounterpartAvatar member={counterpart} />
                      <div style={{ minWidth: 0 }}>
                        <div className="font-medium text-[11px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-alternative)] mb-0.5">
                          {isOut ? "검토자" : "요청자"}
                        </div>
                        <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-strong)] overflow-hidden text-ellipsis whitespace-nowrap">
                          {counterpart.name ?? counterpart.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-center">
                    <ReviewStatusChip status={request.status} />
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-center font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
                    {request.requestedAt}
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--w-line-alternative)] group-hover:bg-[var(--w-bg-neutral)] text-[var(--w-fg-alternative)]">
                    <Icon name="arrow-right" size={14} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function CounterpartAvatar({ member }: { member: Member }) {
  return (
    <div
      className="w-7 h-7 rounded-full text-white grid place-items-center font-bold text-[11px] leading-none [font-family:var(--w-font-display)] flex-none"
      style={{ background: member.avatarBg || "var(--w-fg-neutral)" }}
    >
      {member.name?.[0] ?? "?"}
    </div>
  );
}

function CampaignStatusChip({ status }: { status: string }) {
  const def = STATUS_CHIP[status] ?? { label: status, chip: "neutral" as ChipVariant };
  return <Chip variant={def.chip} dot>{def.label}</Chip>;
}

function ReviewStatusChip({ status }: { status: "pending" | "approved" | "rejected" }) {
  const def = REVIEW_STATUS[status];
  return <Chip variant={def.chip} dot>{def.label}</Chip>;
}
