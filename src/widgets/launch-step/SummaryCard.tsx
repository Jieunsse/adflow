"use client";

// 우측 컬럼 하단의 "집행 요약" 카드 — PRD §5.4.3.
// 디테일 모드면 캠페인 목표·입찰·플레이스먼트·A/B·되돌림 행 추가. 간단 모드면 기본 행만.

import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { Badge } from "@shared/ui/primitives";
import { fmtKRW } from "@shared/lib/format";
import { OBJECTIVES_PHASE1, OBJECTIVES_PHASE2 } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";

export default function SummaryCard() {
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const { data: session } = useSession();

  const browseMode = !!session?.browseMode;
  const accountConnected = browseMode || !!(session?.adAccountId && session?.pageId);
  const hasCreative = creative.state.headline.trim().length > 0;
  const launched = launch.state.launchedCampaign;

  const budgetNum = parseInt(launch.state.budget.replace(/[^\d]/g, ""), 10) || 0;
  const days = (() => {
    const a = new Date(launch.state.dateStart);
    const b = new Date(launch.state.dateEnd);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 7;
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  })();

  const selectedGoal = creative.state.outcome
    ? [...OBJECTIVES_PHASE1, ...OBJECTIVES_PHASE2].find((o) => o.id === creative.state.outcome)
    : null;
  const goalLabel = selectedGoal?.label ?? "미선택";
  const goalSub = selectedGoal
    ? `${selectedGoal.metaObjective.replace(/^OUTCOME_/, "")} · ${selectedGoal.optimizationGoal}`
    : undefined;
  const bidStrategyLabel: Record<typeof launch.state.bidStrategy, string> = {
    LOWEST_COST_WITHOUT_CAP: "최저 비용",
    LOWEST_COST_WITH_BID_CAP: "대상 비용",
    COST_CAP: "목표 단가",
  };
  const placementLabel =
    launch.state.placements.mode === "auto"
      ? "Advantage+ 자동"
      : `수동 · ${launch.state.placements.positions.length}곳`;
  const platformsLabel =
    launch.state.platforms === "both" ? "페이스북 · 인스타그램"
    : launch.state.platforms === "facebook" ? "페이스북만"
    : "인스타그램만";

  return (
    <Card>
      <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] mb-3.5">집행 요약</h3>
      <div>
        <SumRow label="캠페인 목표" value={goalLabel} sub={goalSub} />
        <SumRow label="구매 유형" value="경매(Auction)" />
        <SumRow label="광고 플랫폼" value={platformsLabel} />
        <SumRow label="게재 위치" value={placementLabel} />
        <SumRow label="특별 카테고리" value="없음" />
        <SumRow label="게재 상태" value={launch.state.delivery === "ACTIVE" ? "지금 바로 게재" : "일시중지로 생성"} />
        <SumRow label="총 예산" value={fmtKRW(budgetNum * days)} sub={`${fmtKRW(budgetNum)} × ${days}일`} />
        {launch.state.mode === "detailed" && (
          <>
            <SumRow
              label="입찰 전략"
              value={bidStrategyLabel[launch.state.bidStrategy]}
              sub={launch.state.bidAmount ? `bid ₩${launch.state.bidAmount.toLocaleString("ko-KR")}` : undefined}
            />
            <SumRow
              label="A/B 소재 시험"
              value={launch.state.abTestEnabled ? "켜짐" : "꺼짐"}
              sub={launch.state.abTestEnabled && launch.state.abTestVariantB?.axis === "headline" ? `B안: ${launch.state.abTestVariantB.headline}` : undefined}
            />
            <SumRow label="자동 광고중단" value={launch.state.autoPauseGuardrailEnabled ? "켜짐 (곧 연동)" : "꺼짐"} />
          </>
        )}
      </div>
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-[12px] leading-none text-[var(--w-fg-normal)]">Meta 연결 상태</span>
        {accountConnected ? <Badge kind="success" dot live>연결됨</Badge> : <Badge kind="warn" dot>미연결</Badge>}
      </div>
      <div className="flex flex-col gap-2.5">
        <CheckRow on={hasCreative}>광고 소재 준비</CheckRow>
        <CheckRow on={accountConnected}>광고 계정·페이지 연결</CheckRow>
        <CheckRow on={!!launched}>Meta API 집행 완료</CheckRow>
      </div>
    </Card>
  );
}

function SumRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-[var(--w-line-alternative)]">
      <span className="font-medium text-[12.5px] leading-none text-[var(--w-fg-normal)]">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">{value}</span>
        {sub && <div className="font-medium text-[11.5px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-neutral)] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function CheckRow({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 font-medium text-[13px] leading-[1.4] text-[var(--w-fg-normal)]">
      <span className={cn(
        "w-[18px] h-[18px] rounded-full grid place-items-center text-[11px]",
        on ? "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]" : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)]"
      )}>
        {on ? <Icon name="check" size={11} /> : ""}
      </span>
      <span>{children}</span>
    </div>
  );
}
