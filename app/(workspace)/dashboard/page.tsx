"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Badge, Sparkline } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/cn";
import { fmt, fmtKRW, shortDate, campaignRunDays } from "@shared/lib/format";
import SpendPerfFlowCard from "@shared/ui/SpendPerfFlowCard";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { upsertProfile } from "@features/brand-profile/model/brandProfileStore";
import { deriveAccountVerdict, deriveHeroLayout, type AccountVerdict, type AccountVerdictCampaign } from "@entities/insights/account-verdict";
import { contributionMargin, bepRoas } from "@entities/insights/profit";
import { pickPerfAxis, deriveFunnel, deriveEfficiency, deriveTrendMetrics, perfLineLabel, trendSubtitle, type AccountDailyPoint, type FunnelStage } from "@entities/insights/account-trend";
import { GOOD_CTR_PCT } from "@entities/insights/thresholds";
import BillingAlertWidget from "@widgets/billing-alert";
import type { Billing } from "@entities/billing/types";
import type { CampaignSummary } from "@/lib/meta-ads";

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

// ADR-059 — 계정 횡단 일별 합산 추세. 실유저=계정 레벨 단일 콜, 브라우즈=mock 분산. staleTime 캐시.
async function fetchTrend(): Promise<AccountDailyPoint[]> {
  const res = await fetch("/api/dashboard/trend");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.daily ?? []) as AccountDailyPoint[];
}


function toVerdictCampaign(c: CampaignSummary): AccountVerdictCampaign {
  return {
    id: c.id,
    headline: c.headline,
    status: c.status,
    objective: c.objective,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.ctr,
    spend: c.spend,
    dailyBudget: c.dailyBudget,
    adSetId: c.adSetId,
    daysOfData: campaignRunDays(c.startDate, c.endDate),
    linkClick: c.linkClick,
    landingPageView: c.landingPageView,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const accountConnected = !!(session?.adAccountName && session?.pageName);
  const name = session?.user?.name?.trim();

  // ADR-060 — 브랜드 전역 마진율(공헌이익·BEP 입력). 저장은 브랜드 프로필 단일소스(upsert).
  const { profile: brandProfile, profiles: brandProfiles, activeId: brandActiveId } = useBrandProfileStorage(!!session?.browseMode);
  const marginRate = brandProfile.marginRate ?? null;
  const saveMargin = useCallback(
    (rate: number | null) => {
      const entry = brandProfiles.find((p) => p.id === brandActiveId);
      if (!entry) return;
      upsertProfile({ ...entry, marginRate: rate ?? undefined });
    },
    [brandProfiles, brandActiveId],
  );
  const goCreate = () => router.push("/create");
  const goConnect = () => router.push("/setup");

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

  const trendQ = useQuery({
    queryKey: ["dashboard", "trend"],
    queryFn: fetchTrend,
    enabled: !!session?.adAccountId || !!session?.browseMode,
    staleTime: 5 * 60_000,
  });
  const daily = trendQ.data ?? [];

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const avgCtr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;

  const verdict = useMemo(() => deriveAccountVerdict(campaigns.map(toVerdictCampaign)), [campaigns]);

  // ADR-057 — 전환 가치(읽기 경로). 전환 캠페인 + 매출 측정된 부분집합만. 없으면 게이트.
  const conversionCampaigns = campaigns.filter((c) => c.objective === "OUTCOME_SALES" && c.purchaseValue != null);
  const conversionSpend = conversionCampaigns.reduce((s, c) => s + c.spend, 0);
  const conversionValue = conversionCampaigns.reduce((s, c) => s + (c.purchaseValue ?? 0), 0);
  const accountRoas = conversionSpend > 0 ? Math.round((conversionValue / conversionSpend) * 100) / 100 : 0;

  // ADR-059 — 듀얼추세 성과축(매출/도착/클릭 적응) + degrade 퍼널(노출 분모 고정).
  const perfAxis = useMemo(() => pickPerfAxis(daily, conversionCampaigns.length), [daily, conversionCampaigns.length]);
  const trendMetrics = useMemo(() => deriveTrendMetrics(daily, perfAxis), [daily, perfAxis]);
  const funnel = useMemo(
    () => deriveFunnel(campaigns.map((c) => ({ impressions: c.impressions, clicks: c.clicks, landingPageView: c.landingPageView, purchaseCount: c.purchaseCount }))),
    [campaigns],
  );

  const liveCount = campaigns.filter((c) => c.status === "live").length;
  // ADR-059 — 인사말 강등: 1급 표면 자격 박탈 → overline 옆 1줄 보조.
  const greetingLine =
    campaigns.length === 0
      ? "첫 광고를 만들어 성과를 확인해 보세요."
      : liveCount > 0
        ? `광고 ${liveCount}개 게재 중`
        : "게재 중인 광고 없음";

  const loading = campaignsQ.isLoading;

  // 데이터 양 기반 점진 노출(progressive disclosure) — 한 화면에 dashed 박스 최대 1개.
  // empty: 캠페인 0 → EVIDENCE 전체 숨김. seeding: 집행했으나 일별 < 2 → 추세 dashed + KPI만.
  const hasImpressions = totalImpressions > 0;
  const evidenceLoading = campaignsQ.isLoading || trendQ.isLoading;
  const volume: "empty" | "seeding" | "full" = evidenceLoading
    ? "full"
    : campaigns.length === 0
      ? "empty"
      : daily.length < 2
        ? "seeding"
        : "full";
  const ctrTrend = daily.length >= 2 ? daily.map((d) => (d.impressions ? (d.clicks / d.impressions) * 100 : 0)) : undefined;
  const spendTrend = daily.length >= 2 ? daily.map((d) => d.spend / 1000) : undefined;
  // 빈 0 금지: 노출 없으면 신호칩 숨김(미집행 0 ≠ 실측 0).
  const ctrSignal = !hasImpressions
    ? null
    : avgCtr >= GOOD_CTR_PCT
      ? { tone: "positive" as const, text: "사람들이 광고에 반응해요" }
      : { tone: "neutral" as const, text: `반응이 더 필요해요 (기준 ${GOOD_CTR_PCT}%)` };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-6" data-screen-label="대시보드">
      <div className="flex justify-between items-center gap-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">대시보드</span>
          <Badge kind="success" dot live>실시간 동기화</Badge>
          <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] truncate">
            안녕하세요{name ? `, ${name}님` : ""} · {greetingLine}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" type="button" onClick={() => router.push("/campaigns")}>캠페인 목록</Button>
          <Button variant="primary" type="button" onClick={goCreate}><Icon name="plus" size={16} /> 새 광고 만들기</Button>
        </div>
      </div>

      {!accountConnected && !session?.browseMode && (
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

      {/* ── DECISION 층 — 계정 평결 hero(ADR-057). 어떤 상태에서도 시각 정점. ──
          매출 0 사용자에게도 결론. collecting 은 onboarding 밀도로 강등(ADR-060 §6). */}
      {loading ? (
        <Skeleton className="h-[96px] rounded-[20px]" />
      ) : (
        <AccountVerdictHero
          verdict={verdict}
          busy={false}
          onPause={(id) => router.push(`/campaigns/${id}`)}
          onIncreaseBudget={(id) => router.push(`/campaigns/${id}`)}
          onDetail={(id) => router.push(`/campaigns/${id}`)}
        />
      )}

      {/* empty — EVIDENCE 전체 숨김, 단일 "다음 단계" 슬롯만(dashed 0개). */}
      {volume === "empty" ? (
        <NextStepSlot onCreate={goCreate} />
      ) : (
        /* ── EVIDENCE 층 — 한 단계 강등. 층간 낙차 40px(gap-6 + mt-6)로 묶음. ── */
        <div className="mt-6">
          <EvidenceHeading>이 결론의 근거</EvidenceHeading>

          {/* 좌(2/3) 추세+퍼널 세로 스택 · 우(1/3) 핵심숫자+플로 세로 스택 — 열별로 묶고
              stretch 로 두 열 높이를 맞춘다(플로 카드가 남는 세로를 흡수). */}
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 flex flex-col gap-5">
              <SpendPerfFlowCard
                loading={loading || trendQ.isLoading}
                enough={daily.length >= 2}
                labels={daily.map((d) => shortDate(d.date))}
                spend={daily.map((d) => d.spend)}
                efficiency={deriveEfficiency(daily, perfAxis)}
                verdict={trendMetrics.verdict}
                perfLabel={perfLineLabel(perfAxis)}
                shortLabel={perfAxis.label}
                subtitle={trendSubtitle(trendMetrics.verdict, perfAxis)}
                midIndex={trendMetrics.midIndex}
                earlyAvg={trendMetrics.earlyAvg}
                lateAvg={trendMetrics.lateAvg}
                divergeRange={trendMetrics.divergeRange}
                isDemo={!!session?.browseMode}
                emptyTitle={totalSpend > 0 ? "성과 흐름이 모이는 중" : "곧 성과 흐름이 여기 모여요"}
                emptyDesc={perfAxis.metric === "revenue" && !perfAxis.hasData
                  ? "전환을 켜면 매출 효율이 여기 그려져요."
                  : "광고가 며칠 더 게재되면 지출 대비 성과 흐름을 보여드려요."}
                onSeeCampaigns={() => router.push("/campaigns")}
              />
              {/* full — 퍼널은 추세 바로 밑으로 붙인다. seeding — 안내 1줄로 대체. */}
              {volume === "full" && (
                <FunnelCard loading={loading} stages={funnel.stages} hasData={funnel.hasData} />
              )}
            </div>
            <div className="flex flex-col gap-5">
              <CtrTile value={hasImpressions ? avgCtr.toFixed(2) : null} trend={ctrTrend} signal={ctrSignal} caption="노출되면 채워져요" />
              <SpendTile value={fmtKRW(totalSpend)} trend={spendTrend} caption="이번 기간 집행액" />
              {/* 공헌이익 타일(ADR-060) — 전환 캠페인 있을 때만 KPI 스택 3번째로 흡수. */}
              {volume === "full" && conversionCampaigns.length > 0 && (
                <ProfitCard
                  conversionValue={conversionValue}
                  conversionSpend={conversionSpend}
                  roas={accountRoas}
                  count={conversionCampaigns.length}
                  marginRate={marginRate}
                  onSaveMargin={saveMargin}
                />
              )}
            </div>
          </div>

          {volume === "seeding" && <SeedingNote />}
        </div>
      )}
    </div>
  );
}

// ── EVIDENCE 구분 — 오버라인 + 헤어라인. 층간 묶음을 시각화. ──────────────────
function EvidenceHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-overline whitespace-nowrap">{children}</span>
      <span className="flex-1 h-px bg-[var(--w-line-neutral)]" />
    </div>
  );
}

// ── 핵심숫자 타일 (ADR-059) — 오버라인 + mono 큰 숫자 + sparkline + 신호칩. ──────
function KpiSignalChip({ tone, children }: { tone: "positive" | "neutral"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 self-start font-semibold text-[11px] leading-none px-2 py-1 rounded-full",
        tone === "positive"
          ? "bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)]"
          : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)]",
      )}
    >
      {tone === "positive" && <Icon name="check-circle" size={11} />}
      {children}
    </span>
  );
}

function DashedValue({ caption }: { caption: string }) {
  return (
    <>
      <div className="h-8 w-16 rounded-lg border border-dashed border-[var(--w-line-normal)] grid place-items-center text-[var(--w-fg-alternative)] [font-family:var(--w-font-mono)] text-[20px] font-semibold">—</div>
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)]">{caption}</div>
    </>
  );
}

const monoBig = "font-bold text-[28px] leading-[1.05] tracking-[-0.02em] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]";

function CtrTile({ value, trend, signal, caption }: { value: string | null; trend?: number[]; signal: { tone: "positive" | "neutral"; text: string } | null; caption: string }) {
  return (
    <Card variant="quiet" className="flex flex-col gap-2.5">
      <div className="w-overline">평균 CTR</div>
      {value ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className={monoBig}>{value}</span>
            <span className="font-semibold text-[15px] text-[var(--w-fg-neutral)]">%</span>
          </div>
          {trend && <Sparkline data={trend} color="var(--w-primary-normal)" fill height={28} />}
          {signal && <KpiSignalChip tone={signal.tone}>{signal.text}</KpiSignalChip>}
        </>
      ) : (
        <DashedValue caption={caption} />
      )}
    </Card>
  );
}

function SpendTile({ value, trend, caption }: { value: string; trend?: number[]; caption: string }) {
  return (
    <Card variant="quiet" className="flex flex-col gap-2.5">
      <div className="w-overline">총 지출</div>
      <div className={monoBig}>{value}</div>
      {trend && <Sparkline data={trend} color="var(--w-data-muted)" fill height={28} />}
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)]">{caption}</div>
    </Card>
  );
}

// ── empty — 단일 "다음 단계" 슬롯. 큰 일러스트성 빈 카드 + CTA 1개. ─────────────
function NextStepSlot({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center text-center gap-3 py-14 rounded-[20px]">
      <span className="grid place-items-center w-[72px] h-[72px] rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]">
        <Icon name="sparkles" size={32} />
      </span>
      <h3 className="w-display-editorial mt-1">첫 광고를 만들어 보세요</h3>
      <p className="w-body text-[var(--w-fg-neutral)] max-w-[420px]">
        브랜드 정보를 입력하면 AI가 카피와 이미지를 만들어 드려요. 게재가 시작되면 이 화면이 성과 대시보드로 바뀌어요.
      </p>
      <div className="mt-2">
        <Button variant="primary" size="md" type="button" onClick={onCreate}>
          <Icon name="plus" size={16} /> 첫 광고 만들기
        </Button>
      </div>
    </Card>
  );
}

// ── seeding — 퍼널이 곧 열린다는 1줄 안내. ──────────────────────────────
function SeedingNote() {
  return (
    <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--w-bg-alternative)]">
      <Icon name="info" size={15} className="text-[var(--w-fg-neutral)] shrink-0" />
      <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">광고가 더 게재되면 전환 경로 진단이 여기 열려요.</span>
    </div>
  );
}

// ── T2 degrade 퍼널 (ADR-059) — 노출 분모 고정 비율막대. SVG 깔때기 거부. ───────────
function FunnelCard({ loading, stages, hasData }: { loading: boolean; stages: FunnelStage[]; hasData: boolean }) {
  return (
    <Card className="h-full">
      <div className="mb-4">
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">전환 경로</h2>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">노출에서 구매까지 어디서 새는지 단계별로 봐요.</p>
      </div>
      {loading ? (
        <Skeleton className="h-[200px] rounded-xl" />
      ) : !hasData ? (
        <ChartEmptySlot title="전환 경로를 추적할 준비됐어요" desc="광고가 노출되기 시작하면 단계별 흐름이 여기 채워져요." height={200} />
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((s) => <FunnelBar key={s.key} stage={s} />)}
        </div>
      )}
    </Card>
  );
}

function FunnelBar({ stage }: { stage: FunnelStage }) {
  const widthPct = Math.max(stage.value > 0 ? 2 : 0, Math.round(stage.pctOfImpressions * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">{stage.label}</span>
        <div className="flex items-center gap-2">
          {stage.stepRate != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold text-[11px] leading-none px-1.5 py-1 rounded-full",
                stage.bigDrop
                  ? "bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)]"
                  : "text-[var(--w-fg-alternative)]",
              )}
            >
              {stage.bigDrop && <Icon name="trend-down" size={11} />}
              {Math.round(stage.stepRate * 100)}%
            </span>
          )}
          <span className="font-bold text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmt(stage.value)}</span>
        </div>
      </div>
      {stage.measured ? (
        <div className="h-2.5 rounded-full bg-[var(--w-bg-alternative)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--w-primary-normal)]" style={{ width: `${widthPct}%` }} />
        </div>
      ) : (
        <div className="h-2.5 rounded-full border border-dashed border-[var(--w-line-normal)]" />
      )}
      {stage.measured
        ? stage.denomLabel && <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">{stage.denomLabel}</span>
        : <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">아직 측정 안 됨 · 측정 켜기</span>}
    </div>
  );
}

// ── empty 캐논 (ADR-059) — 차트-높이 border-dashed 슬롯. 빈 차트보다 흉하지 않게. ──────
function ChartEmptySlot({ title, desc, height = 260 }: { title: string; desc: string; height?: number }) {
  return (
    <div
      className="rounded-xl border border-dashed border-[var(--w-line-normal)] grid place-items-center text-center px-8"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-1.5">
        <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-neutral)]">{title}</div>
        <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-alternative)] max-w-[320px]">{desc}</div>
      </div>
    </div>
  );
}

// ── 계정 평결 hero (ADR-059 amendment §1) — 전용 복합 밴드. 시각 무게 1위. ──────────
// 색맹 a11y: 신호등 이모지 단독 금지 — icon + 텍스트 라벨 동반.
const VERDICT_UI: Record<AccountVerdict["status"], { tone: "positive" | "negative" | "cautionary"; icon: "warn" | "trend-up" | "check-circle" | "clock"; label: string }> = {
  collecting: { tone: "cautionary", icon: "clock", label: "데이터 모으는 중" },
  trap: { tone: "negative", icon: "warn", label: "함정 의심" },
  poor: { tone: "negative", icon: "warn", label: "점검 필요" },
  cruising: { tone: "positive", icon: "trend-up", label: "호조" },
  stable: { tone: "positive", icon: "check-circle", label: "안정적" },
};

function AccountVerdictHero({
  verdict, busy, onPause, onIncreaseBudget, onDetail,
}: {
  verdict: AccountVerdict; busy: boolean;
  onPause: (campaignId: string) => void;
  onIncreaseBudget: (campaignId: string) => void;
  onDetail: (campaignId: string) => void;
}) {
  const ui = VERDICT_UI[verdict.status];
  const { density, showAction, showGrounding } = deriveHeroLayout(verdict);
  const a = verdict.primaryAction;
  const rich = density === "rich";
  const soft = `var(--w-status-${ui.tone}-soft)`;
  const accent = `var(--w-status-${ui.tone})`;

  const action = showAction && a
    ? a.kind === "pause"
      ? <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={() => onPause(a.campaignId)}>{a.label}</Button>
      : <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={() => onIncreaseBudget(a.campaignId)}>{a.label}</Button>
    : null;

  return (
    <div
      className={cn("flex gap-4 rounded-[20px]", rich ? "items-start" : "items-center")}
      style={{
        background: soft,
        borderLeft: `4px solid ${accent}`,
        padding: rich ? "24px" : "16px 20px",
      }}
    >
      {rich ? (
        <span className="grid place-items-center rounded-full shrink-0" style={{ width: 48, height: 48, background: "var(--w-bg-elevated)", color: accent }}>
          <Icon name={ui.icon} size={28} />
        </span>
      ) : (
        <Icon name={ui.icon} size={18} className="shrink-0" style={{ color: accent }} />
      )}

      <div className="flex-1 min-w-0">
        {rich && (
          <div className="font-bold text-[11px] leading-none uppercase tracking-[0.05em]" style={{ color: accent }}>
            {ui.label}
          </div>
        )}
        <div className={cn(rich ? "w-h2 mt-1.5" : "font-semibold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]")} style={{ textWrap: "pretty" }}>
          {verdict.headline}
        </div>
        {showGrounding && verdict.reasonLine && (
          <div className={cn(rich ? "text-[13px] mt-1.5" : "text-[12.5px] mt-1", "font-medium leading-[1.5] text-[var(--w-fg-neutral)]")}>
            {verdict.reasonLine}
          </div>
        )}
        {density === "onboarding" && (
          <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">
            광고가 며칠 더 게재되면 무엇을 손볼지 여기서 짚어드려요.
          </div>
        )}
      </div>

      {(action || (showAction && a)) && (
        <div className="inline-flex gap-2 shrink-0">
          {action}
          {a && <Button variant="ghost" size="sm" type="button" onClick={() => onDetail(a.campaignId)}>상세 보기</Button>}
        </div>
      )}
    </div>
  );
}

// ── 손익 카드 (ADR-060) — 공헌이익·BEP ROAS. ROAS 는 보조로 강등(색 신호화 금지). ────
// 게이트=전환 캠페인 ≥1(호출부). 마진 미입력=티저+인라인 quick-add→브랜드 프로필 영구저장.
function ProfitCard({
  conversionValue, conversionSpend, roas, count, marginRate, onSaveMargin,
}: {
  conversionValue: number; conversionSpend: number; roas: number; count: number;
  marginRate: number | null; onSaveMargin: (rate: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(marginRate != null ? String(Math.round(marginRate * 100)) : "");
    setEditing(true);
  };
  const pct = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(pct) && pct > 0 && pct <= 100;
  const submit = () => {
    if (!valid) return;
    onSaveMargin(pct / 100);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="font-medium text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">평균 마진율 입력</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-20 px-2.5 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[18px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] text-right focus:outline-none focus:border-[var(--w-focus-ring)]"
          />
          <span className="font-bold text-[18px] text-[var(--w-fg-neutral)]">%</span>
        </div>
        <p className="font-medium text-[11.5px] leading-[1.5] text-[var(--w-fg-alternative)]">
          광고비를 뺀 전 제품 평균 마진율이에요. 정확한 값이 아니어도 대략의 손익 방향을 볼 수 있어요.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" type="button" disabled={!valid} onClick={submit}>저장하고 손익 보기</Button>
          {marginRate != null && <Button variant="ghost" size="sm" type="button" onClick={() => setEditing(false)}>취소</Button>}
        </div>
      </Card>
    );
  }

  if (marginRate == null) {
    return (
      <Card variant="quiet" className="flex flex-col justify-between gap-3 bg-[var(--w-bg-alternative)]">
        <div>
          <div className="font-medium text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">공헌이익 · 손익</div>
          <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-2">
            원가(마진율)를 넣으면 ROAS 너머 <span className="text-[var(--w-fg-strong)]">진짜 남는 이익</span>이 보여요.
          </p>
        </div>
        <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-[var(--w-primary-press)] hover:underline">
          마진율 넣기 <Icon name="arrow-right" size={13} />
        </button>
      </Card>
    );
  }

  const contribution = contributionMargin(conversionValue, conversionSpend, marginRate);
  const bep = bepRoas(marginRate);
  const profitable = (contribution ?? 0) >= 0;
  const bepHit = bep != null && roas >= bep;
  const tone = profitable ? "positive" : "negative";

  return (
    <Card className="flex flex-col gap-1.5 border-transparent" style={{ background: `var(--w-status-${tone}-soft)` }}>
      <div className="font-medium text-[11px] leading-none uppercase tracking-[0.04em]" style={{ color: `var(--w-status-${tone})` }}>공헌이익 · 손익</div>
      <div className="font-bold text-[26px] leading-[1.1] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">{fmtKRW(contribution ?? 0)}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <Icon name={bepHit ? "check-circle" : "warn"} size={14} style={{ color: `var(--w-status-${tone})` }} />
        <span className="font-semibold text-[13px] leading-none text-[var(--w-fg-neutral)]">
          {bepHit ? "손익분기 달성" : "손익분기 미달"} · BEP ROAS {bep?.toFixed(2)}x
        </span>
      </div>
      <div className="border-t border-[var(--w-line-normal)] mt-2.5 pt-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[11px] leading-[1.4] text-[var(--w-fg-alternative)]">
            전 제품 평균 마진 {Math.round(marginRate * 100)}% 가정 · 참고 ROAS {roas.toFixed(2)}x · 전환 캠페인 {count}개
          </span>
          <button type="button" onClick={startEdit} className="shrink-0 font-semibold text-[11px] text-[var(--w-primary-press)] hover:underline">수정</button>
        </div>
        <div className="flex items-start gap-1 font-medium text-[11px] leading-[1.4] text-[var(--w-fg-alternative)]">
          <Icon name="info" size={12} className="mt-px shrink-0" />
          <span>라스트클릭 기준이라 인지·상단 퍼널 기여는 빠져 있어요.</span>
        </div>
      </div>
    </Card>
  );
}
