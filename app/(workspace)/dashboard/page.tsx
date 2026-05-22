"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { Badge, EmptyState, KpiCard } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { SegControl } from "@shared/ui/SegControl";
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

const STATUS_CHIP: Record<CampaignStatusBucket, { variant: ChipVariant; label: string }> = {
  live:    { variant: "live",    label: "게재 중" },
  paused:  { variant: "paused",  label: "일시정지" },
  review:  { variant: "review",  label: "검토 중" },
  ended:   { variant: "ended",   label: "종료" },
  issue:   { variant: "issue",   label: "문제 있음" },
};

function StatusChip({ status }: { status: CampaignStatusBucket }) {
  const s = STATUS_CHIP[status];
  if (!s) return null;
  return <Chip variant={s.variant} dot>{s.label}</Chip>;
}

const DASHBOARD_LIST_LIMIT = 5;

type RangeKey = "day" | "week" | "month" | "custom";
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "day",    label: "오늘" },
  { value: "week",   label: "이번 주" },
  { value: "month",  label: "이번 달" },
  { value: "custom", label: "기간 지정" },
];

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

  const billingQ = useQuery({
    queryKey: ["billing"],
    queryFn: fetchBilling,
    enabled: !!session?.adAccountId,
    staleTime: 60_000,
  });

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
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="대시보드">
      {/* 헤더 */}
      <div className="flex justify-between items-end gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">대시보드</span>
            <Badge kind="success" dot live>실시간 동기화</Badge>
          </div>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">
            안녕하세요{name ? `, ${name}님` : ""} 👋
          </h1>
          <p className="mt-1.5 mb-0 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] tracking-[0.004em]">
            오늘 광고 3개가 게재 중이고, 어제 대비 클릭이 12% 늘었어요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" type="button"><Icon name="refresh" size={16} /> 새로고침</Button>
          <Button variant="primary" type="button" onClick={goCreate}><Icon name="plus" size={16} /> 새 광고 만들기</Button>
        </div>
      </div>

      {/* 미연결 배너 */}
      {!accountConnected && (
        <Card className="flex items-center gap-4 border-[var(--w-status-cautionary)] bg-[rgba(255,146,0,0.05)]">
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(255,146,0,0.15)] text-[var(--w-status-cautionary)] grid place-items-center shrink-0">
            <Icon name="warn" size={20} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[14.5px] leading-[1.3] text-[var(--w-fg-strong)]">광고 계정이 아직 연결되지 않았어요</div>
            <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px]">Meta 광고 계정과 페이지를 연결하면 광고를 만들고 집행할 수 있어요.</div>
          </div>
          <Button variant="primary" size="sm" type="button" onClick={goConnect}>연결하러 가기 <Icon name="arrow-right" size={14} /></Button>
        </Card>
      )}

      <BillingAlertWidget billing={billingQ.data} mode="top" />

      {/* 성과 요약 */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">전체 성과 요약</h2>
          <SegControl value={range} onChange={setRange} options={RANGE_OPTIONS} />
        </div>
        <div className="grid grid-cols-4 gap-3.5">
          <KpiCard label="총 노출수" value={fmt(totalImpressions)} delta="+8.4%" up trend={[20, 28, 32, 40, 45, 55, 60, 72, 85, 92, 98, 104, 118, 128]} />
          <KpiCard label="총 클릭수" value={fmt(totalClicks)} delta="+12.1%" up trend={[10, 14, 16, 22, 28, 30, 32, 38, 46, 54, 58, 62, 70, 78]} />
          <KpiCard label="평균 CTR" value={avgCtr.toFixed(2)} suffix="%" delta="+0.18%p" up trend={[2.1, 2.2, 2.15, 2.3, 2.4, 2.35, 2.4, 2.5, 2.55, 2.6, 2.62, 2.65, 2.7, 2.67]} />
          <KpiCard label="총 지출" value={fmtKRW(totalSpend)} delta="−3.2%" down trend={[40, 55, 62, 58, 72, 68, 75, 80, 82, 76, 72, 70, 68, 65]} color="var(--w-accent-violet)" />
        </div>
      </div>

      {/* 캠페인 목록 + 힌트/활동 */}
      <div className="grid grid-cols-[1.55fr_1fr] gap-5">
        <Card>
          <div className="flex items-center justify-between gap-3 mb-[18px]">
            <div>
              <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">집행한 캠페인</h2>
              <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">캠페인을 클릭하면 상세 성과를 볼 수 있어요.</p>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={goCampaigns}>전체 보기 <Icon name="arrow-right" size={14} /></Button>
          </div>
          {campaignsQ.isLoading ? (
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
            </div>
          ) : visibleCampaigns.length === 0 ? (
            <EmptyState
              icon={<Icon name="megaphone" size={26} />}
              title={accountConnected ? "아직 집행한 캠페인이 없어요" : "광고 계정을 연결하면 캠페인이 표시돼요"}
              desc={accountConnected ? "AI가 만든 소재로 첫 광고를 시작해 보세요." : undefined}
              action={
                <Button variant="primary" size="sm" type="button" onClick={accountConnected ? goCreate : goConnect}>
                  <Icon name={accountConnected ? "plus" : "link"} size={14} /> {accountConnected ? "첫 캠페인 만들기" : "계정 연결하러 가기"}
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {visibleCampaigns.map((c) => <CampaignRow key={c.id} c={c} onClick={() => goCampaignDetail(c.id)} />)}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5">
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
      className="grid grid-cols-[1fr_88px_88px_88px_100px_110px] items-center gap-3 p-3.5 border border-[var(--w-line-alternative)] rounded-xl bg-[var(--w-bg-elevated)] cursor-pointer text-left w-full transition-[border-color,background] duration-[120ms] hover:border-[var(--w-line-normal)]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusChip status={c.status} />
          <span className="font-medium text-[11.5px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-alternative)]">{c.id.slice(-10)}</span>
        </div>
        <div className="font-semibold text-[14.5px] leading-[1.4] text-[var(--w-fg-strong)] overflow-hidden text-ellipsis whitespace-nowrap">{c.headline}</div>
        <div className="font-medium text-xs leading-none text-[var(--w-fg-neutral)] mt-1">{daysLine}</div>
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
    <div className="flex flex-col gap-1">
      <span className="font-medium text-[10.5px] leading-none text-[var(--w-fg-alternative)] tracking-[0.04em] uppercase">{label}</span>
      <span className="font-semibold text-[14px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{value}</span>
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
    <Card>
      <h2 className="m-0 mb-3.5 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">최근 활동</h2>
      {items.length === 0 ? (
        <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
          아직 활동이 없어요. 첫 캠페인을 만들면 여기 표시돼요.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((it, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg bg-[var(--w-bg-alternative)] grid place-items-center shrink-0" style={{ color: it.color }}>
                <Icon name={it.icon} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[13px] leading-[1.45] text-[var(--w-fg-normal)]">{it.text}</div>
                <div className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)] mt-1">{timeAgo(it.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
    <Card className="bg-[linear-gradient(135deg,rgba(0,102,255,0.04),rgba(101,65,242,0.06))] border-transparent">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon name="sparkles" size={16} style={{ color: "var(--w-accent-violet)" }} />
        <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-accent-violet)]">AI 제안</span>
      </div>
      <div className="font-semibold text-[15px] leading-[1.4] text-[var(--w-fg-strong)] tracking-[-0.008em]">
        {hint.title}
      </div>
      <p className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] my-2.5 mb-4">
        {hint.desc}
      </p>
      <Button variant="inverse" size="sm" type="button" onClick={onCreate}>
        <Icon name="sparkles" size={14} /> {hint.cta}
      </Button>
    </Card>
  );
}
