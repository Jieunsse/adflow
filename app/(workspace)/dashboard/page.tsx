"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { Badge, EmptyState, KpiCard } from "@shared/ui/primitives";
import { fmt, fmtKRW, campaignDateInfo, timeAgo } from "@shared/lib/format";
import BillingAlertWidget from "@widgets/billing-alert";
import type { Billing } from "@entities/billing/types";
import type { CampaignStatusBucket, CampaignSummary } from "@/lib/meta-ads";

async function fetchBilling(): Promise<Billing> {
  const res = await fetch("/api/billing");
  if (!res.ok) throw new Error("결제 정보를 불러오지 못했어요");
  return res.json();
}

async function fetchCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch("/api/campaigns?period=all");
  if (res.status === 401) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "캠페인을 불러오지 못했어요");
  return (data.campaigns ?? []) as CampaignSummary[];
}

const STATUS_CHIP: Record<CampaignStatusBucket, { variant: string; label: string }> = {
  live: { variant: "live", label: "게재 중" },
  paused: { variant: "paused", label: "일시정지" },
  review: { variant: "review", label: "검토 중" },
  ended: { variant: "ended", label: "종료" },
  issue: { variant: "issue", label: "문제 있음" },
};

function StatusChip({ status }: { status: CampaignStatusBucket }) {
  const s = STATUS_CHIP[status];
  if (!s) return null;
  return (
    <span className={`chip chip--${s.variant}`}>
      <span className="chip__dot" />
      {s.label}
    </span>
  );
}

const DASHBOARD_LIST_LIMIT = 5;

type RangeKey = "day" | "week" | "month" | "custom";
const RANGE_LABELS: Record<RangeKey, string> = { day: "오늘", week: "이번 주", month: "이번 달", custom: "기간 지정" };

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [range, setRange] = useState<RangeKey>("week");

  const accountConnected = !!(session?.adAccountName && session?.pageName);
  const name = session?.user?.name?.trim();
  const goCreate = () => router.push("/create");
  const goConnect = () => router.push("/setup");
  const goCampaigns = () => router.push("/campaigns");
  const goCampaignDetail = (id: string) => router.push(`/campaigns/${id}`);

  // PRD-billing §6 — billing 페이지와 동일 queryKey 로 캐시 공유 (staleTime 60s).
  const billingQ = useQuery({
    queryKey: ["billing"],
    queryFn: fetchBilling,
    enabled: !!session?.adAccountId,
    staleTime: 60_000,
  });

  // /campaigns 페이지 기본 period('all')과 동일 queryKey 로 캐시 공유.
  const campaignsQ = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: fetchCampaigns,
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 60_000,
  });
  const campaigns = campaignsQ.data ?? [];
  const visibleCampaigns = campaigns.slice(0, DASHBOARD_LIST_LIMIT);

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const avgCtr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <div className="page" data-screen-label="대시보드">
      <div className="page__head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>대시보드</span>
            <Badge kind="success" dot live>실시간 동기화</Badge>
          </div>
          <h1 className="page__title">안녕하세요{name ? `, ${name}님` : ""} 👋</h1>
          <p className="page__sub">오늘 광고 3개가 게재 중이고, 어제 대비 클릭이 12% 늘었어요.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--secondary" type="button"><Icon name="refresh" size={16} /> 새로고침</button>
          <button className="btn btn--primary" type="button" onClick={goCreate}><Icon name="plus" size={16} /> 새 광고 만들기</button>
        </div>
      </div>

      {!accountConnected && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, borderColor: "var(--w-status-cautionary)", background: "rgba(255,146,0,0.05)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,146,0,0.15)", color: "var(--w-status-cautionary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="warn" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "600 14.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>광고 계정이 아직 연결되지 않았어요</div>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3 }}>Meta 광고 계정과 페이지를 연결하면 광고를 만들고 집행할 수 있어요.</div>
          </div>
          <button className="btn btn--primary btn--sm" type="button" onClick={goConnect}>연결하러 가기 <Icon name="arrow-right" size={14} /></button>
        </div>
      )}

      <BillingAlertWidget billing={billingQ.data} mode="top" />


      <div>
        <div className="between" style={{ marginBottom: 14 }}>
          <h2 className="section-title">전체 성과 요약</h2>
          <div className="seg">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
              <button key={k} className={range === k ? "on" : ""} type="button" onClick={() => setRange(k)}>{RANGE_LABELS[k]}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <KpiCard label="총 노출수" value={fmt(totalImpressions)} delta="+8.4%" up trend={[20, 28, 32, 40, 45, 55, 60, 72, 85, 92, 98, 104, 118, 128]} />
          <KpiCard label="총 클릭수" value={fmt(totalClicks)} delta="+12.1%" up trend={[10, 14, 16, 22, 28, 30, 32, 38, 46, 54, 58, 62, 70, 78]} />
          <KpiCard label="평균 CTR" value={avgCtr.toFixed(2)} suffix="%" delta="+0.18%p" up trend={[2.1, 2.2, 2.15, 2.3, 2.4, 2.35, 2.4, 2.5, 2.55, 2.6, 2.62, 2.65, 2.7, 2.67]} />
          <KpiCard label="총 지출" value={fmtKRW(totalSpend)} delta="−3.2%" down trend={[40, 55, 62, 58, 72, 68, 75, 80, 82, 76, 72, 70, 68, 65]} color="var(--w-accent-violet)" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="between" style={{ marginBottom: 18 }}>
            <div>
              <h2 className="section-title">집행한 캠페인</h2>
              <p className="section-sub">캠페인을 클릭하면 상세 성과를 볼 수 있어요.</p>
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={goCampaigns}>전체 보기 <Icon name="arrow-right" size={14} /></button>
          </div>
          {campaignsQ.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skel" style={{ height: 76, borderRadius: 12 }} />
              ))}
            </div>
          ) : visibleCampaigns.length === 0 ? (
            <EmptyState
              icon={<Icon name="megaphone" size={26} />}
              title={accountConnected ? "아직 집행한 캠페인이 없어요" : "광고 계정을 연결하면 캠페인이 표시돼요"}
              desc={accountConnected ? "AI가 만든 소재로 첫 광고를 시작해 보세요." : undefined}
              action={
                <button className="btn btn--primary btn--sm" type="button" onClick={accountConnected ? goCreate : goConnect}>
                  <Icon name={accountConnected ? "plus" : "link"} size={14} /> {accountConnected ? "첫 캠페인 만들기" : "계정 연결하러 가기"}
                </button>
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleCampaigns.map((c) => <CampaignRow key={c.id} c={c} onClick={() => goCampaignDetail(c.id)} />)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <HintsCard campaigns={campaigns} onCreate={goCreate} />
          <ActivityCard campaigns={campaigns} />
        </div>
      </div>
    </div>
  );
}

function CampaignRow({ c, onClick }: { c: CampaignSummary; onClick: () => void }) {
  const { daysLine } = campaignDateInfo(c.startDate, c.endDate, c.status);
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 88px 88px 88px 100px 110px",
        alignItems: "center",
        gap: 12,
        padding: "14px 14px",
        border: "1px solid var(--w-line-alternative)",
        borderRadius: 12,
        background: "var(--w-bg-elevated)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--w-line-normal)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--w-line-alternative)")}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <StatusChip status={c.status} />
          <span style={{ font: "500 11.5px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)" }}>{c.id.slice(-10)}</span>
        </div>
        <div style={{ font: "600 14.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.headline}</div>
        <div style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{daysLine}</div>
      </div>
      <Metric label="노출" value={c.impressions ? fmt(c.impressions) : "—"} />
      <Metric label="클릭" value={c.clicks ? fmt(c.clicks) : "—"} />
      <Metric label="CTR" value={c.ctr ? c.ctr.toFixed(2) + "%" : "—"} />
      <Metric label="지출" value={c.spend ? fmtKRW(c.spend) : "—"} />
      <Metric label="일일예산" value={c.dailyBudget != null ? fmtKRW(c.dailyBudget) : "—"} />
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "500 10.5px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ font: "600 14px/1 var(--w-font-mono)", color: "var(--w-fg-strong)" }}>{value}</span>
    </div>
  );
}

type ActivityItem = { text: string; ts: number; icon: IconName; color: string };

function startTs(startDate: string | null): number | null {
  if (!startDate) return null;
  const ts = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function buildActivityItems(campaigns: CampaignSummary[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const c of campaigns) {
    const ts = startTs(c.startDate);
    if (ts == null) continue;
    switch (c.status) {
      case "live":
        items.push(
          c.impressions >= 1000 && c.ctr >= 2
            ? { text: `${c.headline} 캠페인 CTR이 ${c.ctr.toFixed(2)}%로 호조예요`, ts, icon: "trend-up", color: "var(--w-status-positive)" }
            : { text: `${c.headline} 캠페인이 게재되고 있어요`, ts, icon: "megaphone", color: "var(--w-primary-normal)" },
        );
        break;
      case "paused":
        items.push({ text: `${c.headline} 캠페인이 일시정지됐어요`, ts, icon: "pause", color: "var(--w-status-cautionary)" });
        break;
      case "ended":
        items.push({ text: `${c.headline} 캠페인이 종료됐어요`, ts, icon: "check", color: "var(--w-fg-alternative)" });
        break;
      case "review":
        items.push({ text: `${c.headline} 캠페인이 Meta 검토 중이에요`, ts, icon: "clock", color: "var(--w-accent-violet)" });
        break;
      case "issue":
        items.push({ text: `${c.headline} 캠페인에 문제가 있어요`, ts, icon: "warn", color: "var(--w-status-cautionary)" });
        break;
    }
  }
  items.sort((a, b) => b.ts - a.ts);
  return items.slice(0, 4);
}

function ActivityCard({ campaigns }: { campaigns: CampaignSummary[] }) {
  const items = useMemo(() => buildActivityItems(campaigns), [campaigns]);
  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 14 }}>최근 활동</h2>
      {items.length === 0 ? (
        <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
          아직 활동이 없어요. 첫 캠페인을 만들면 여기 표시돼요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--w-bg-alternative)", color: it.color, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                <Icon name={it.icon} size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "500 13px/1.45 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>{it.text}</div>
                <div style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginTop: 4 }}>{timeAgo(it.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Hint = { title: ReactNode; desc: string; cta: string };
const MIN_HINT_IMPRESSIONS = 1000;
const LOW_HINT_CTR = 0.8;

function deriveHint(campaigns: CampaignSummary[]): Hint {
  if (campaigns.length === 0) {
    return {
      title: <>첫 광고를 만들면 AI가 다음 광고를 위한 제안을 시작해요.</>,
      desc: "광고 성과가 쌓이면 가장 반응 좋은 소재·타겟·시간대를 분석해 다음 광고에 반영해드릴게요.",
      cta: "첫 광고 만들기",
    };
  }
  const ready = campaigns.filter((c) => c.impressions >= MIN_HINT_IMPRESSIONS);
  if (ready.length === 0) {
    const totalImpr = campaigns.reduce((s, c) => s + c.impressions, 0);
    return {
      title: <>데이터를 모으는 중 — 누적 노출 <span style={{ color: "var(--w-primary-press)" }}>{fmt(totalImpr)}회</span></>,
      desc: `광고당 노출이 ${fmt(MIN_HINT_IMPRESSIONS)}회를 넘으면 어떤 소재·타겟이 잘 통하는지 분석해드릴 수 있어요.`,
      cta: "광고 추가로 만들기",
    };
  }
  const best = ready.reduce((a, b) => (b.ctr > a.ctr ? b : a));
  if (best.ctr < LOW_HINT_CTR) {
    return {
      title: <>최근 광고가 평균보다 클릭이 적어요 — 가장 높은 CTR <span style={{ color: "var(--w-primary-press)" }}>{best.ctr.toFixed(2)}%</span></>,
      desc: "트래픽 광고 평균(1~2%) 아래예요. 새 소재나 더 좁은 타겟으로 한 번 더 시도해보세요.",
      cta: "새 광고 만들기",
    };
  }
  return {
    title: <><span style={{ color: "var(--w-primary-press)" }}>{best.headline}</span> 캠페인이 CTR {best.ctr.toFixed(2)}%로 가장 반응이 좋아요.</>,
    desc: "비슷한 소재·타겟으로 다음 광고를 만들면 AI가 자동으로 이 성공 패턴을 반영해드릴게요.",
    cta: "다음 광고 만들기",
  };
}

function HintsCard({ campaigns, onCreate }: { campaigns: CampaignSummary[]; onCreate: () => void }) {
  const hint = useMemo(() => deriveHint(campaigns), [campaigns]);
  return (
    <div className="card" style={{ background: "linear-gradient(135deg, rgba(0,102,255,0.04), rgba(101,65,242,0.06))", borderColor: "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name="sparkles" size={16} style={{ color: "var(--w-accent-violet)" }} />
        <span className="w-overline" style={{ color: "var(--w-accent-violet)" }}>AI 제안</span>
      </div>
      <div style={{ font: "600 15px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.008em" }}>
        {hint.title}
      </div>
      <p style={{ font: "500 13px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 16px" }}>
        {hint.desc}
      </p>
      <button className="btn btn--inverse btn--sm" type="button" onClick={onCreate}>
        <Icon name="sparkles" size={14} /> {hint.cta}
      </button>
    </div>
  );
}
