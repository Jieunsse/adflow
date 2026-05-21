"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { useLaunchDraft } from "@entities/campaign/model";

const AB_RESULT_DAYS = 7;

type ItemStatus = "ok" | "pending" | "warn" | "info";

interface Item {
  title: string;
  body: string;
  status: ItemStatus;
  action?: React.ReactNode;
}

type CampaignBucket = "live" | "review" | "paused" | "ended" | "issue";
interface CampaignBrief { status: CampaignBucket; impressions: number }

const STATUS_META: Record<ItemStatus, { bg: string; color: string; label?: string }> = {
  ok:      { bg: "rgba(0,191,64,0.12)",   color: "var(--w-status-positive)", label: "완료" },
  warn:    { bg: "rgba(220,38,38,0.10)",   color: "var(--w-status-negative)", label: "확인 필요" },
  pending: { bg: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)",   label: "진행 중" },
  info:    { bg: "var(--w-primary-soft)",   color: "var(--w-accent-violet)" },
};

function StepBadge({ status, num }: { status: ItemStatus; num: number }) {
  const m = STATUS_META[status];
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
      background: m.bg, color: m.color,
      display: "grid", placeItems: "center",
    }}>
      {status === "ok"
        ? <Icon name="check" size={13} strokeWidth={3} />
        : status === "warn"
          ? <Icon name="alert-triangle" size={13} />
          : <span style={{ font: "700 12px/1 var(--w-font-sans)" }}>{num}</span>}
    </div>
  );
}

function CheckItem({ item, num }: { item: Item; num: number }) {
  const m = STATUS_META[item.status];
  const isDone = item.status === "ok";
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <StepBadge status={item.status} num={num} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: isDone ? 0 : 5 }}>
          <span style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: isDone ? "var(--w-fg-neutral)" : "var(--w-fg-strong)" }}>
            {item.title}
          </span>
          {m.label && (
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: m.bg, color: m.color }}>
              {m.label}
            </span>
          )}
        </div>
        {!isDone && (
          <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: 0 }}>
            {item.body}
          </p>
        )}
        {item.action && <div style={{ marginTop: 10 }}>{item.action}</div>}
      </div>
    </div>
  );
}

function CtaCard({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  return (
    <div className="card" style={{
      padding: "18px 20px", marginTop: 8,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      background: "var(--w-primary-soft)",
    }}>
      <div>
        <div style={{ font: "600 14px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 3 }}>
          성과는 며칠 후부터 쌓여요
        </div>
        <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: 0 }}>
          캠페인 페이지에서 매일 확인해보세요.
        </p>
      </div>
      <button
        className="btn btn--primary btn--sm"
        type="button"
        style={{ flexShrink: 0 }}
        onClick={() => router.push(href)}
      >
        {label} <Icon name="arrow-right" size={13} />
      </button>
    </div>
  );
}

function BottomNav({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="between" style={{ marginTop: 24 }}>
      <button className="btn btn--secondary" type="button" onClick={onRestart}>
        처음으로 돌아가기
      </button>
      <button className="btn btn--primary" type="button" onClick={onRestart}>
        새 소재로 다시 만들기 <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

function abResultDateStr(startDate: string): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + AB_RESULT_DAYS);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const BROWSE_MOCK_CAMPAIGN_ID = "demo-campaign-001";

function BrowseChecklist({ onRestart }: { onRestart: () => void }) {
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
  }, []);

  const items: Item[] = [
    {
      title: "광고가 잘 검토되고 있는지 확인해봐요",
      body: "Meta가 광고를 검토하고 있어요. 보통 수 분 ~ 수 시간 걸려요.",
      status: "info",
    },
    {
      title: "노출이 시작됐는지 확인해봐요",
      body: "노출이 시작되면 알림으로 알려드릴게요. (수 시간 ~ 수 일)",
      status: "info",
    },
    {
      title: "결과 알림이 잘 켜져 있는지 확인해봐요",
      body: notifPerm === "granted"
        ? "푸시 알림이 켜져 있어요 ✓"
        : "푸시 알림을 켜면 성과·A/B 결과를 바로 받을 수 있어요.",
      status: notifPerm === "granted" ? "ok" : "info",
      action: notifPerm === "default" ? (
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          onClick={() => Notification.requestPermission().then(setNotifPerm)}
        >
          알림 허용하기
        </button>
      ) : undefined,
    },
  ];

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", marginBottom: 16,
        background: "var(--w-primary-soft)", borderRadius: 10,
      }}>
        <Icon name="info" size={14} style={{ color: "var(--w-accent-violet)", flexShrink: 0 }} />
        <p style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: 0 }}>
          예시 데이터예요. 실제 광고를 집행하면 실시간 상태가 여기에 표시돼요.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => <CheckItem key={i} item={item} num={i + 1} />)}
      </div>

      <CtaCard label="캠페인 페이지에서 보기" href={`/campaigns/${BROWSE_MOCK_CAMPAIGN_ID}`} />
      <BottomNav onRestart={onRestart} />
    </div>
  );
}

export default function PostLaunchChecklist({ onRestart }: { onRestart: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { state: launchState } = useLaunchDraft();
  const launched = launchState.launchedCampaign;

  const { data: campaignData, refetch } = useQuery<{ campaign: CampaignBrief }>({
    queryKey: ["checklist-campaign", launched?.campaignId],
    enabled: !!launched?.campaignId,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/campaign/${launched!.campaignId}`);
      if (!res.ok) throw new Error("캠페인 조회 실패");
      return res.json();
    },
  });
  const campaign = campaignData?.campaign;

  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
  }, []);

  if (!launched) {
    if (session?.browseMode) return <BrowseChecklist onRestart={onRestart} />;
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ font: "500 14px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginBottom: 16 }}>
          아직 광고가 집행되지 않았어요. STEP 02에서 광고를 먼저 집행해주세요.
        </p>
        <button className="btn btn--secondary" type="button" onClick={onRestart}>
          처음으로 돌아가기
        </button>
      </div>
    );
  }

  const reviewMap: Record<CampaignBucket, { body: string; status: ItemStatus }> = {
    review: { body: "Meta가 광고를 검토하고 있어요. 보통 수 분 ~ 수 시간 걸려요.", status: "pending" },
    live:   { body: "검토를 통과했어요 ✓", status: "ok" },
    paused: { body: "광고가 일시정지 상태예요. Meta 광고 관리자에서 켜주세요.", status: "info" },
    issue:  { body: "광고가 거절됐어요. Meta 광고 관리자에서 사유를 확인하세요.", status: "warn" },
    ended:  { body: "광고가 종료됐어요.", status: "info" },
  };
  const reviewEntry = reviewMap[campaign?.status ?? "review"];
  const impressions = campaign?.impressions ?? 0;

  const items: Item[] = [
    {
      title: "광고가 잘 검토되고 있는지 확인해봐요",
      ...reviewEntry,
      action: (
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => refetch()}>
          <Icon name="refresh" size={12} /> 새로고침
        </button>
      ),
    },
    {
      title: "노출이 시작됐는지 확인해봐요",
      body: impressions > 0
        ? `노출이 시작됐어요. 첫 ${impressions.toLocaleString()}회 노출이 쌓였어요 ✓`
        : "노출이 시작되면 알림으로 알려드릴게요. (수 시간 ~ 수 일)",
      status: impressions > 0 ? "ok" : "pending",
    },
    {
      title: "결과 알림이 잘 켜져 있는지 확인해봐요",
      body: notifPerm === "granted"
        ? "푸시 알림이 켜져 있어요 ✓"
        : notifPerm === "denied"
          ? "브라우저 설정에서 알림을 허용하면 성과·A/B 결과를 받을 수 있어요."
          : "푸시 알림을 켜면 성과·A/B 결과를 바로 받을 수 있어요.",
      status: notifPerm === "granted" ? "ok" : "info",
      action: notifPerm === "default" ? (
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          onClick={() => Notification.requestPermission().then(setNotifPerm)}
        >
          알림 허용하기
        </button>
      ) : undefined,
    },
  ];

  if (launched.abTestAxis && launched.adIds) {
    items.push({
      title: "A/B 결과 자동 결정이 예약돼있는지 확인해봐요",
      body: `${abResultDateStr(launched.startDate)}에 자동으로 우세 안을 정해드릴게요. 결과는 알림으로 도착해요.`,
      status: "info",
    });
  }

  return (
    <div>
      {/* 접수 확인 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 20px", marginBottom: 16,
        background: "rgba(0,191,64,0.06)",
        border: "1px solid rgba(0,191,64,0.18)",
        borderRadius: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: "rgba(0,191,64,0.12)", color: "var(--w-status-positive)",
          display: "grid", placeItems: "center",
        }}>
          <Icon name="check" size={18} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            광고가 접수됐어요
          </div>
          <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "2px 0 0" }}>
            지금 Meta에서 처리 중이에요. 아래 사항을 확인해봐요.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => <CheckItem key={i} item={item} num={i + 1} />)}
      </div>

      <CtaCard label="캠페인 보기" href={`/campaigns/${launched.campaignId}`} />
      <BottomNav onRestart={onRestart} />
    </div>
  );
}
