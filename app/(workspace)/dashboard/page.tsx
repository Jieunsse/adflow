"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Badge, KpiCard, Sparkline } from "@shared/ui/primitives";
import { fmt, fmtKRW } from "@shared/lib/format";

type CampaignStatus = "live" | "paused" | "review";
interface MockCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  days: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  dailyBudget: number;
  trend: number[];
}

const MOCK_CAMPAIGNS: MockCampaign[] = [
  {
    id: "cmp_120207641834", name: "여름 시즌 한정 — 트로피컬 아이스티",
    status: "live", days: "5월 8일 – 5월 21일",
    impressions: 184320, clicks: 4926, ctr: 2.67, spend: 482000, dailyBudget: 50000,
    trend: [120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285, 312, 340, 365],
  },
  {
    id: "cmp_120207641709", name: "신상 런칭 — 콜드브루 오리지널",
    status: "live", days: "5월 3일 – 5월 17일",
    impressions: 98140, clicks: 2104, ctr: 2.14, spend: 268500, dailyBudget: 30000,
    trend: [80, 95, 110, 102, 118, 124, 132, 145, 148, 162, 170, 168, 175, 188],
  },
  {
    id: "cmp_120207639518", name: "수험생 응원 — 에너지 패키지",
    status: "paused", days: "4월 25일 – 5월 9일",
    impressions: 62480, clicks: 1287, ctr: 2.06, spend: 158000, dailyBudget: 25000,
    trend: [90, 102, 95, 88, 78, 70, 64, 58, 52, 48, 40, 38, 34, 30],
  },
  {
    id: "cmp_120207638203", name: "어버이날 특별 패키지 (예시)",
    status: "review", days: "5월 4일 – 5월 12일",
    impressions: 0, clicks: 0, ctr: 0, spend: 0, dailyBudget: 40000,
    trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

const STATUS_CHIP: Record<CampaignStatus, { variant: string; label: string }> = {
  live: { variant: "live", label: "게재 중" },
  paused: { variant: "paused", label: "일시정지" },
  review: { variant: "review", label: "검토 중" },
};

function StatusChip({ status }: { status: CampaignStatus }) {
  const s = STATUS_CHIP[status];
  if (!s) return null;
  return (
    <span className={`chip chip--${s.variant}`}>
      <span className="chip__dot" />
      {s.label}
    </span>
  );
}

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

  const totalImpressions = MOCK_CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = MOCK_CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const totalSpend = MOCK_CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
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
            <button className="btn btn--ghost btn--sm" type="button">전체 보기 <Icon name="arrow-right" size={14} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOCK_CAMPAIGNS.map((c) => <CampaignRow key={c.id} c={c} onClick={goCreate} />)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <HintsCard onCreate={goCreate} />
          <ActivityCard />
        </div>
      </div>
    </div>
  );
}

function CampaignRow({ c, onClick }: { c: MockCampaign; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 88px 88px 96px 100px 80px",
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
        <div style={{ font: "600 14.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
        <div style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{c.days}</div>
      </div>
      <Metric label="노출" value={c.impressions ? fmt(c.impressions) : "—"} />
      <Metric label="클릭" value={c.clicks ? fmt(c.clicks) : "—"} />
      <Metric label="CTR" value={c.ctr ? c.ctr.toFixed(2) + "%" : "—"} />
      <Metric label="지출" value={c.spend ? fmtKRW(c.spend) : "—"} />
      <Sparkline data={c.trend} color={c.status === "paused" ? "var(--w-status-cautionary)" : "var(--w-primary-normal)"} fill />
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

function ActivityCard() {
  const items = [
    { text: "여름 시즌 한정 캠페인이 게재되기 시작했어요", time: "12분 전", icon: "megaphone", color: "var(--w-primary-normal)" },
    { text: "콜드브루 캠페인 CTR이 2.14%로 올라갔어요", time: "1시간 전", icon: "trend-up", color: "var(--w-status-positive)" },
    { text: "에너지 패키지 캠페인이 일시정지됐어요", time: "어제", icon: "pause", color: "var(--w-status-cautionary)" },
    { text: "어버이날 특별 패키지 소재 3건이 생성됐어요", time: "2일 전", icon: "sparkles", color: "var(--w-accent-violet)" },
  ] as const;
  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 14 }}>최근 활동</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--w-bg-alternative)", color: it.color, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <Icon name={it.icon} size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "500 13px/1.45 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>{it.text}</div>
              <div style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginTop: 4 }}>{it.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HintsCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card" style={{ background: "linear-gradient(135deg, rgba(0,102,255,0.04), rgba(101,65,242,0.06))", borderColor: "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name="sparkles" size={16} style={{ color: "var(--w-accent-violet)" }} />
        <span className="w-overline" style={{ color: "var(--w-accent-violet)" }}>AI 제안</span>
      </div>
      <div style={{ font: "600 15px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.008em" }}>
        지난주 성과를 보면 <span style={{ color: "var(--w-primary-press)" }}>20–30대 여성</span> 타겟이 가장 반응이 좋았어요.
      </div>
      <p style={{ font: "500 13px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 16px" }}>
        다음 광고를 만들 때 AI가 자동으로 이 정보를 반영해 카피와 타겟팅을 추천할게요.
      </p>
      <button className="btn btn--inverse btn--sm" type="button" onClick={onCreate}>
        <Icon name="sparkles" size={14} /> 다음 광고 만들기
      </button>
    </div>
  );
}
