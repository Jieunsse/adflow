// 대시보드 "오늘의 진단" — 효과가 큰 순서로 정렬한 액션 큐(최대 3건).
// 저자 = 룰(결정적·무료·즉시). 새 숫자 0 — isFakePerformance·deriveConversionSummary·profit 의
// 기존 파생값만 문장으로 엮는다. ADR-031 — 실측 수치만 인용하고, 근거가 없으면 그 카드를 아예 내지 않는다.

import { isFakePerformance } from "./fake-performance";
import { deriveConversionSummary, type ConversionSummary } from "./period-kpis";
import { contributionMargin, bepRoas } from "./profit";
import { campaignRunDays, fmt, fmtKRW } from "@shared/lib/format";
import type { CampaignSummary } from "@/lib/meta-ads";

export type ActionAccent = "negative" | "primary" | "neutral";

// value 가 "A → B" 형태면 호출부가 그대로 렌더한다 — 파싱하지 않는다.
export type ActionStat = { label: string; value: string; strong?: boolean };

export type ActionButton = {
  label: string;
  variant: "primary" | "danger" | "ghost" | "secondary";
  // 클릭 시 이동/실행은 화면이 정한다. 여기서는 "무엇을 가리키는지"만.
  target: { kind: "campaign"; id: string } | { kind: "campaigns" } | { kind: "measurement" } | { kind: "margin" };
};

export type ActionItem = {
  id: string;
  accent: ActionAccent;
  title: string;
  body: string;
  stats: ActionStat[];
  buttons: ActionButton[];
};

export type ActionQueueInput = {
  campaigns: CampaignSummary[];
  marginRate: number | null;
  /** 기간 전체 지출(계정 횡단 일별 합산). 전환 측정 커버리지 분모. */
  totalSpend: number;
  /** 전환 캠페인 ROAS 의 직전 기간 대비 변화율(%). 없으면 문장에서 생략. */
  roasDeltaPct?: number;
};

const MAX_ITEMS = 3;
const BUDGET_BUMP_RATIO = 1.3; // optimization.ts 의 +30% 증액과 같은 폭

const quoted = (headline: string) => `'${headline}'`;
const roasText = (n: number) => `${n.toFixed(2)}x`;

// 이 광고비까지 매출로 회수하려면 전환 캠페인 ROAS 가 얼마여야 하는지.
//   marginRate × (roas × conversionSpend) = spendPool  →  roas = spendPool / (marginRate × conversionSpend)
// spendPool 이 conversionSpend 뿐이면 결과는 손익분기 ROAS(1/marginRate) 와 같아진다.
function requiredRoas(spendPool: number, conversionSpend: number, marginRate: number): number | null {
  if (marginRate <= 0 || conversionSpend <= 0) return null;
  return Math.round((spendPool / (marginRate * conversionSpend)) * 100) / 100;
}

// ① 클릭은 많은데 도착이 안 되는 캠페인 — 지출이 큰 순.
function trapItems(campaigns: CampaignSummary[], conversion: ConversionSummary | null, marginRate: number | null): ActionItem[] {
  return campaigns
    .filter((c) => c.status === "live")
    .map((c) => ({
      c,
      fake: isFakePerformance(
        { impressions: c.impressions, ctr: c.ctr, linkClick: c.linkClick ?? 0, landingPageView: c.landingPageView },
        campaignRunDays(c.startDate, c.endDate),
      ),
    }))
    .filter((x) => x.fake.fake && x.fake.evidence)
    .sort((a, b) => b.c.spend - a.c.spend)
    .map(({ c, fake }) => {
      const ev = fake.evidence!;
      const lost = Math.round((c.linkClick ?? 0) * (ev.dropRate / 100));
      const purchase = c.purchaseCount ?? 0;
      const stats: ActionStat[] = [
        { label: "낭비 중인 광고비", value: fmtKRW(c.spend), strong: true },
      ];
      // 손익분기 A→B 는 마진율과 전환 캠페인이 둘 다 있어야 계산된다. 없으면 이 칸을 비운다.
      if (marginRate != null && conversion && conversion.conversionSpend > 0) {
        const before = requiredRoas(conversion.conversionSpend + c.spend, conversion.conversionSpend, marginRate);
        const after = requiredRoas(conversion.conversionSpend, conversion.conversionSpend, marginRate);
        if (before != null && after != null) {
          stats.push({ label: "멈추면 필요한 ROAS", value: `${roasText(before)} → ${roasText(after)}` });
        }
      }
      return {
        id: `pause-${c.id}`,
        accent: "negative" as const,
        title: `${quoted(c.headline)} 광고를 지금 멈추세요`,
        body:
          `클릭률은 ${c.ctr.toFixed(2)}%로 제일 높은데 도착률이 ${Math.round(ev.landingRate)}%밖에 안 돼요. ` +
          `클릭 ${fmt(c.linkClick ?? 0)}번 중 ${fmt(lost)}번은 페이지를 보지도 못하고 나갔다는 뜻이에요.` +
          (purchase === 0 ? " 전환은 0건이고요." : ` 전환은 ${fmt(purchase)}건이고요.`),
        stats,
        buttons: [
          { label: "광고 멈추기", variant: "danger" as const, target: { kind: "campaign" as const, id: c.id } },
          { label: "랜딩 먼저 보기", variant: "ghost" as const, target: { kind: "campaign" as const, id: c.id } },
        ],
      };
    });
}

// ② 전환이 잡히는 캠페인 — 손익분기 위/아래에 따라 권하는 행동이 정반대라 분기한다.
function conversionItem(
  campaigns: CampaignSummary[],
  conversion: ConversionSummary,
  marginRate: number | null,
  roasDeltaPct?: number,
): ActionItem | null {
  const convCampaigns = campaigns
    .filter((c) => c.objective === "OUTCOME_SALES" && c.purchaseValue != null)
    .sort((a, b) => (b.purchaseValue ?? 0) - (a.purchaseValue ?? 0));
  const best = convCampaigns[0];
  if (!best) return null;

  const trendLine = roasDeltaPct != null && roasDeltaPct > 0 ? ` 지난 기간 대비 ${roasDeltaPct.toFixed(1)}% 좋아지고 있어요.` : "";
  const lead =
    convCampaigns.length === 1
      ? `${fmt(campaigns.filter((c) => c.status === "live").length)}개 캠페인 중 유일하게 전환이 잡히는 캠페인이에요.`
      : `전환이 잡히는 ${convCampaigns.length}개 캠페인 중 매출이 가장 큰 캠페인이에요.`;
  const facts = `전환 ${fmt(conversion.conversionCount)}건, ROAS ${roasText(conversion.roas)}.`;

  // 마진율이 없으면 손익 판정 자체가 불가능 — 증액도 경고도 하지 않고 마진율부터 받는다.
  if (marginRate == null) {
    return {
      id: `conversion-${best.id}`,
      accent: "primary",
      title: `${quoted(best.headline)}에서 전환이 잡히고 있어요`,
      body: `${lead} ${facts}${trendLine} 다만 원가를 몰라서 이 매출이 남는 장사인지는 아직 알 수 없어요.`,
      stats: [{ label: "마진율을 넣으면", value: "공헌이익까지 계산해 드려요", strong: true }],
      buttons: [{ label: "마진율 넣기", variant: "primary", target: { kind: "margin" } }],
    };
  }

  const bep = bepRoas(marginRate);
  const contribution = contributionMargin(conversion.conversionValue, conversion.conversionSpend, marginRate);

  // 손익분기 위 — 증액분만큼 공헌이익이 늘어난다(매출이 지출에 비례한다고 본 추정).
  if (bep != null && conversion.roas >= bep) {
    const bumpSpend = conversion.conversionSpend * (BUDGET_BUMP_RATIO - 1);
    const gain = Math.round(bumpSpend * (marginRate * conversion.roas - 1));
    return {
      id: `boost-${best.id}`,
      accent: "primary",
      title: `${quoted(best.headline)}에 예산을 몰아주세요`,
      body: `${lead} ${facts}${trendLine}`,
      stats: [{ label: "예산을 30% 올리면", value: `공헌이익 +${fmtKRW(gain)} 예상`, strong: true }],
      buttons: [{ label: "예산 30% 올리기", variant: "primary", target: { kind: "campaign", id: best.id } }],
    };
  }

  // 손익분기 아래 — 여기서 증액을 권하면 손해를 키운다. 넘겨야 할 선을 대신 알려준다.
  const bepCpa =
    conversion.conversionCount > 0 ? Math.round((conversion.conversionValue / conversion.conversionCount) * marginRate) : null;
  const worse = contribution != null ? Math.round(contribution * BUDGET_BUMP_RATIO - contribution) : null;
  return {
    id: `bep-${best.id}`,
    accent: "primary",
    title: `${quoted(best.headline)}는 아직 손익분기 아래예요`,
    body:
      `${lead} ${facts}${trendLine} ` +
      `마진 ${Math.round(marginRate * 100)}% 기준 손익분기는 ${roasText(bep ?? 0)}라, ` +
      `지금 예산을 30% 올리면 공헌이익이 ${fmtKRW(Math.abs(worse ?? 0))}만큼 더 나빠져요.`,
    stats: bepCpa != null ? [{ label: "손익분기를 넘기려면", value: `전환당 ${fmtKRW(bepCpa)} 이하로`, strong: true }] : [],
    buttons: [{ label: "캠페인 자세히 보기", variant: "primary", target: { kind: "campaign", id: best.id } }],
  };
}

// ③ 손익을 계산할 수 없는 광고비 — 이 화면 숫자의 신뢰 구간을 스스로 밝힌다.
function coverageItem(campaigns: CampaignSummary[], conversion: ConversionSummary | null, totalSpend: number): ActionItem | null {
  const measuredSpend = conversion?.conversionSpend ?? 0;
  const unmeasured = Math.round(totalSpend - measuredSpend);
  const unmeasuredCount = campaigns.filter(
    (c) => (c.status === "live" || c.status === "paused") && c.spend > 0 && !(c.objective === "OUTCOME_SALES" && c.purchaseValue != null),
  ).length;
  if (unmeasured <= 0 || unmeasuredCount === 0 || totalSpend <= 0) return null;

  const coveredPct = Math.round((measuredSpend / totalSpend) * 100);
  return {
    id: "coverage",
    accent: "neutral",
    title: `나머지 캠페인 ${unmeasuredCount}개에 전환 측정을 붙여주세요`,
    body:
      measuredSpend > 0
        ? `지금 손익은 전체 광고비의 ${coveredPct}%만 보고 계산한 값이에요. 나머지 ${fmtKRW(unmeasured)}은 벌었는지 잃었는지 알 수 없어요.`
        : `전환을 측정하는 캠페인이 하나도 없어요. 지금 쓰고 있는 ${fmtKRW(unmeasured)}이 벌었는지 잃었는지 알 수 없어요.`,
    stats: [],
    buttons: [{ label: "측정 스크립트 받기", variant: "secondary", target: { kind: "measurement" } }],
  };
}

export function deriveActionQueue(input: ActionQueueInput): ActionItem[] {
  const { campaigns, marginRate, totalSpend, roasDeltaPct } = input;
  const conversion = deriveConversionSummary(campaigns);

  const items: ActionItem[] = [
    ...trapItems(campaigns, conversion, marginRate),
    ...(conversion ? [conversionItem(campaigns, conversion, marginRate, roasDeltaPct)] : []),
    coverageItem(campaigns, conversion, totalSpend),
  ].filter((x): x is ActionItem => x !== null);

  return items.slice(0, MAX_ITEMS);
}

// ── 히어로 내러티브 ────────────────────────────────────────────────────────────
// "광고비 X 써서 마진 Y 벌었어요 / Z 손해예요" 3줄. 분모는 전환 캠페인 — 매출을 아는 범위에서만 손익을 말한다.

export type HeroNarrative = {
  spend: number;
  /** 마진율을 아는 경우에만. null 이면 매출 기준으로 문장이 바뀐다. */
  marginRevenue: number | null;
  revenue: number;
  contribution: number | null;
  roas: number;
  bep: number | null;
  conversionCount: number;
  cpa: number;
  /** 손익분기 게이지 채움 비율(0~100). bep 이 없으면 null. */
  bepFillPct: number | null;
  /** 보조 문장 — 개선된 지표 + 퍼널 진단. 근거가 없으면 빈 문자열. */
  supportLine: string;
};

export function deriveHeroNarrative(input: {
  conversion: ConversionSummary | null;
  marginRate: number | null;
  clicksDeltaPct?: number;
  cpcDeltaPct?: number;
  /** 가장 크게 새는 퍼널 단계 라벨(예: "도착"). 없으면 진단 문장 생략. */
  leakStageLabel?: string;
}): HeroNarrative | null {
  const { conversion, marginRate, clicksDeltaPct, cpcDeltaPct, leakStageLabel } = input;
  if (!conversion || conversion.conversionSpend <= 0) return null;

  const bep = bepRoas(marginRate);
  const contribution = contributionMargin(conversion.conversionValue, conversion.conversionSpend, marginRate);

  const goodNews: string[] = [];
  if (clicksDeltaPct != null && clicksDeltaPct > 0) goodNews.push(`클릭은 ${clicksDeltaPct.toFixed(1)}% 늘었`);
  if (cpcDeltaPct != null && cpcDeltaPct < 0) goodNews.push(`CPC는 ${Math.abs(cpcDeltaPct).toFixed(0)}% 싸졌`);
  const profitable = contribution != null && contribution >= 0;

  let supportLine = "";
  if (goodNews.length > 0) {
    const joined = goodNews.join("고 ") + "어요.";
    supportLine = profitable ? `${joined} 지금 흐름을 유지해보세요.` : `좋은 소식도 있어요. ${joined}`;
    if (!profitable && leakStageLabel) supportLine += ` 트래픽은 좋아지는 중이니, ${leakStageLabel} 이후만 고치면 돼요.`;
  } else if (!profitable && leakStageLabel) {
    supportLine = `${leakStageLabel} 단계에서 가장 많이 새고 있어요. 여기부터 고쳐보세요.`;
  }

  return {
    spend: conversion.conversionSpend,
    marginRevenue: marginRate != null ? Math.round(conversion.conversionValue * marginRate) : null,
    revenue: conversion.conversionValue,
    contribution,
    roas: conversion.roas,
    bep,
    conversionCount: conversion.conversionCount,
    cpa: conversion.cpa,
    bepFillPct: bep != null && bep > 0 ? Math.min(100, (conversion.roas / bep) * 100) : null,
    supportLine,
  };
}
