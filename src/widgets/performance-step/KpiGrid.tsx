"use client";

import { KpiCard } from "@shared/ui/primitives";
import { fmt, fmtKRW } from "@shared/lib/format";
import type { Insights, CampaignObjective } from "@entities/insights/types";
import type { ObjectivePhase1Id } from "@entities/creative/options";

interface Props {
  // PRD §13 — goalId 가 있으면 우선 (7 goal 각자의 KPI 카드 셋). 없으면 objective fallback (구 캠페인).
  goalId?: ObjectivePhase1Id;
  objective: CampaignObjective;
  data: Insights;
  exampleMode: boolean;
  scenario: "good" | "poor";
  clicks: number[];
  ctrs: number[];
}

export default function KpiGrid({ goalId, objective, data, exampleMode, scenario, clicks, ctrs }: Props) {
  const grid = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 } as const;

  // 인지도 — 도달·빈도·CPM·노출 (기존 OUTCOME_AWARENESS 와 동일)
  if (goalId === "awareness" || (!goalId && objective === "OUTCOME_AWARENESS")) {
    return (
      <div style={grid}>
        <KpiCard label="도달" value={fmt(data.reach ?? 0)} delta={exampleMode ? "+9.2%" : undefined} up trend={clicks} />
        <KpiCard label="빈도" value={(data.frequency ?? 0).toFixed(2)} suffix="회" delta={exampleMode ? "+0.12" : undefined} up trend={ctrs} />
        <KpiCard label="CPM" value={fmtKRW(data.cpm ?? 0)} delta={exampleMode ? "−4.8%" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
        <KpiCard label="총 노출" value={fmt(data.impressions)} delta={exampleMode ? "+8.4%" : undefined} up trend={[120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285]} />
      </div>
    );
  }

  // 페이지 방문 — 페이지 방문수·노출·CPC·지출
  if (goalId === "traffic_page_visit") {
    return (
      <div style={grid}>
        <KpiCard label="페이지 방문" value={fmt(data.landingPageView ?? 0)} delta={exampleMode ? "+11.0%" : undefined} up trend={clicks} />
        <KpiCard label="총 노출" value={fmt(data.impressions)} delta={exampleMode ? "+8.4%" : undefined} up trend={ctrs} />
        <KpiCard label="CTR" value={data.ctr.toFixed(2)} suffix="%" delta={exampleMode ? "+0.15%p" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
        <KpiCard label="총 지출" value={fmtKRW(data.spend)} delta={exampleMode ? "+5.2%" : undefined} trend={data.daily.map((x) => x.spend / 1000)} />
      </div>
    );
  }

  // 페이지 팔로우 — 신규 좋아요·도달·CPM·노출
  if (goalId === "engagement_page_likes") {
    return (
      <div style={grid}>
        <KpiCard label="신규 페이지 좋아요" value={fmt(data.pageLikeNew ?? 0)} delta={exampleMode ? "+18" : undefined} up trend={clicks} />
        <KpiCard label="도달" value={fmt(data.reach ?? 0)} delta={exampleMode ? "+7.6%" : undefined} up trend={ctrs} />
        <KpiCard label="CPM" value={fmtKRW(data.cpm ?? 0)} delta={exampleMode ? "−3.4%" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
        <KpiCard label="총 노출" value={fmt(data.impressions)} delta={exampleMode ? "+8.0%" : undefined} up trend={clicks} />
      </div>
    );
  }

  // 메시지 받기 — 시작된 대화·도달·CPM·노출
  if (goalId === "engagement_messages") {
    return (
      <div style={grid}>
        <KpiCard label="시작된 대화" value={fmt(data.messagingConversationsStarted ?? 0)} delta={exampleMode ? "+12" : undefined} up trend={clicks} />
        <KpiCard label="도달" value={fmt(data.reach ?? 0)} delta={exampleMode ? "+6.4%" : undefined} up trend={ctrs} />
        <KpiCard label="CPM" value={fmtKRW(data.cpm ?? 0)} delta={exampleMode ? "−2.1%" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
        <KpiCard label="총 노출" value={fmt(data.impressions)} delta={exampleMode ? "+7.2%" : undefined} up trend={clicks} />
      </div>
    );
  }

  // 전화 받기 — 통화 시도·도달·CPM·노출
  if (goalId === "leads_call") {
    return (
      <div style={grid}>
        <KpiCard label="통화 시도" value={fmt(data.callConfirm ?? 0)} delta={exampleMode ? "+5" : undefined} up trend={clicks} />
        <KpiCard label="도달" value={fmt(data.reach ?? 0)} delta={exampleMode ? "+8.1%" : undefined} up trend={ctrs} />
        <KpiCard label="CPM" value={fmtKRW(data.cpm ?? 0)} delta={exampleMode ? "−5.3%" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
        <KpiCard label="총 노출" value={fmt(data.impressions)} delta={exampleMode ? "+10.2%" : undefined} up trend={clicks} />
      </div>
    );
  }

  // 게시물 참여 — 기존 OUTCOME_ENGAGEMENT 와 동일
  if (goalId === "engagement" || (!goalId && objective === "OUTCOME_ENGAGEMENT")) {
    return (
      <div style={grid}>
        <KpiCard label="게시물 반응" value={fmt(data.postReaction ?? 0)} delta={exampleMode ? "+22.4%" : undefined} up trend={clicks} />
        <KpiCard label="댓글" value={fmt(data.postComment ?? 0)} delta={exampleMode ? "+18.0%" : undefined} up trend={ctrs} />
        <KpiCard label="공유" value={fmt(data.postShare ?? 0)} delta={exampleMode ? "+12.6%" : undefined} up trend={clicks} />
        <KpiCard label="페이지 좋아요 증가" value={fmt(data.pageLike ?? 0)} delta={exampleMode ? "+14" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
      </div>
    );
  }

  // 기본 = 트래픽
  return (
    <div style={grid}>
      <KpiCard label="총 노출수" value={fmt(data.impressions)} delta={exampleMode ? "+8.4%" : undefined} up trend={[120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285]} />
      <KpiCard label="총 클릭수" value={fmt(data.clicks)} delta={exampleMode ? "+12.1%" : undefined} up trend={clicks} />
      <KpiCard label="CTR" value={data.ctr.toFixed(2)} suffix="%" delta={exampleMode ? (scenario === "good" ? "+0.18%p" : "−0.34%p") : undefined} up={scenario === "good"} down={scenario === "poor"} trend={ctrs} />
      <KpiCard label="총 지출" value={fmtKRW(data.spend)} delta={exampleMode ? (scenario === "good" ? "−3.2%" : "+18.4%") : undefined} up={scenario === "good"} down={scenario === "poor"} trend={data.daily.map((x) => x.spend / 1000)} color="var(--w-accent-violet)" />
    </div>
  );
}
