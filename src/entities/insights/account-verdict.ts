// ADR-057 — 계정 평결. 단일 캠페인 Verdict(ADR-048)를 계정 횡단으로 우선순위 머지한 hero 결론.
// 저자 = 룰(결정적·무료·즉시), Flo 아님. 새 숫자 0 — 캠페인별 suggestOptimizations + fake-perf 를
// 재사용해 verdict 를 구한 뒤, 가장 무서운 신호(trap > poor > cruising > stable)를 끌어올린다.

import { suggestOptimizations, deriveVerdict, type Suggestion, type VerdictStatus, type OptimizationObjective } from "./optimization";
import { isFakePerformance, type FakePerformanceEvidence } from "./fake-performance";
import { LOW_LANDING_RATE_PCT } from "./thresholds";

// hero 에 필요한 최소 캠페인 입력. CampaignSummary(lib) 의 부분집합 — 레이어 역참조 회피용 좁은 타입.
export type AccountVerdictCampaign = {
  id: string;
  headline: string;
  status: string;
  objective: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  dailyBudget: number | null;
  adSetId: string | null;
  daysOfData: number;
  linkClick?: number;
  landingPageView?: number;
};

export type AccountVerdict = {
  status: VerdictStatus;
  headline: string;
  count: number;
  // ADR-031 가드 — 실측 수치만 인용(지어내기 금지). trap=도착률, 그 외=1순위 제안 detail 첫 줄.
  reasonLine?: string;
  primaryAction?: {
    campaignId: string;
    kind: "pause" | "increase-budget";
    toDailyBudget?: number;
    label: string;
  };
};

// ADR-059 amendment — hero 밀도 차등. status → 렌더 레이아웃 결정(순수). page.tsx 가 소비.
export type HeroDensity = "rich" | "calm" | "onboarding";
export function deriveHeroLayout(verdict: AccountVerdict): {
  density: HeroDensity;
  showAction: boolean;
  showGrounding: boolean;
} {
  switch (verdict.status) {
    case "trap":
    case "poor":
      return { density: "rich", showAction: !!verdict.primaryAction, showGrounding: !!verdict.reasonLine };
    case "collecting":
      return { density: "onboarding", showAction: false, showGrounding: false };
    default:
      return { density: "calm", showAction: false, showGrounding: !!verdict.reasonLine };
  }
}

// 무서운 순서. collecting 은 "판정 보류"라 별도 처리(아래) — 여기엔 안 넣음.
const SEVERITY_RANK: Record<Exclude<VerdictStatus, "collecting">, number> = {
  trap: 4,
  poor: 3,
  cruising: 2,
  stable: 1,
};

// page.tsx(캠페인 상세)와 동일한 캠페인별 suggestions 구성: base + fake-perf 감지 시 증액 숨김·점검 앞세움.
function campaignVerdictStatus(c: AccountVerdictCampaign): { status: VerdictStatus; top: Suggestion; fakeEvidence: FakePerformanceEvidence | null } | null {
  const dailyBudget = c.dailyBudget ?? 50_000;
  const base = suggestOptimizations(
    { impressions: c.impressions, clicks: c.clicks, ctr: c.ctr, spend: c.spend },
    dailyBudget,
    c.daysOfData,
    c.objective as OptimizationObjective,
  );
  const fake = isFakePerformance(
    { impressions: c.impressions, ctr: c.ctr, linkClick: c.linkClick ?? 0, landingPageView: c.landingPageView },
    c.daysOfData,
  );
  const suggestions: Suggestion[] = fake.fake && fake.evidence
    ? [{ kind: "fake-performance", severity: "warn", title: "가짜 성과 의심", detail: [] }, ...base.filter((s) => s.kind !== "increase-budget")]
    : base;
  const v = deriveVerdict(suggestions);
  return v ? { status: v.status, top: v.top, fakeEvidence: fake.fake ? fake.evidence : null } : null;
}

// 근거 1줄 — 실측 수치만(ADR-031). trap=도착률 누수, poor=1순위 제안 detail 첫 줄.
function reasonLineFor(
  status: VerdictStatus,
  top: Suggestion,
  fakeEvidence: FakePerformanceEvidence | null,
): string | undefined {
  if (status === "trap" && fakeEvidence) {
    return `클릭은 많지만 도착률 ${fakeEvidence.landingRate}% (<${LOW_LANDING_RATE_PCT}%) — 픽셀·랜딩 점검이 필요해요`;
  }
  if (status === "poor") return top.detail[0];
  return undefined;
}

// ADR-064 — 리포트 "손볼 캠페인" 리스트용. 계정 hero 로 압축되기 전, 캠페인별 판정을 그대로 노출.
// 단일 축 상하위 랭킹(ADR-057 함정) 대신 이 판정(trap/poor)만 필터해 쓴다.
export type CampaignVerdictEntry = { campaign: AccountVerdictCampaign; status: VerdictStatus; headline: string };

export function deriveCampaignVerdicts(campaigns: AccountVerdictCampaign[]): CampaignVerdictEntry[] {
  return campaigns
    .filter((c) => c.status === "live")
    .map((c) => {
      const v = campaignVerdictStatus(c);
      return v ? { campaign: c, status: v.status, headline: v.top.title } : null;
    })
    .filter((x): x is CampaignVerdictEntry => x !== null);
}

export function deriveAccountVerdict(campaigns: AccountVerdictCampaign[]): AccountVerdict {
  const live = campaigns.filter((c) => c.status === "live");
  if (live.length === 0) {
    return { status: "collecting", headline: "지켜볼 라이브 캠페인이 없어요", count: 0 };
  }

  const verdicts = live.map((c) => ({ c, v: campaignVerdictStatus(c) })).filter((x): x is { c: AccountVerdictCampaign; v: { status: VerdictStatus; top: Suggestion; fakeEvidence: FakePerformanceEvidence | null } } => x.v !== null);

  const actionable = verdicts.filter((x) => x.v.status !== "collecting");
  if (actionable.length === 0) {
    return { status: "collecting", headline: "데이터를 모으는 중이에요", count: 0 };
  }

  // 가장 무서운 신호 1건을 hero 로. 동급이면 입력 순서 유지(목록 우선순위 계승).
  const worst = actionable.reduce((a, b) =>
    SEVERITY_RANK[b.v.status as Exclude<VerdictStatus, "collecting">] > SEVERITY_RANK[a.v.status as Exclude<VerdictStatus, "collecting">] ? b : a,
  );
  const status = worst.v.status;

  if (status === "trap") {
    const count = actionable.filter((x) => x.v.status === "trap" || x.v.status === "poor").length;
    return {
      status,
      headline: count > 1 ? `손볼 캠페인 ${count}건 — "${worst.c.headline}" 가짜 성과 의심` : `"${worst.c.headline}" 가짜 성과가 의심돼요`,
      count,
      reasonLine: reasonLineFor(status, worst.v.top, worst.v.fakeEvidence),
    };
  }

  if (status === "poor") {
    const count = actionable.filter((x) => x.v.status === "poor" || x.v.status === "trap").length;
    const top = worst.v.top;
    const primaryAction = top.kind === "pause" && worst.c.adSetId
      ? { campaignId: worst.c.id, kind: "pause" as const, label: "광고 일시정지" }
      : undefined;
    return {
      status,
      headline: count > 1 ? `지금 손볼 캠페인 ${count}건 — "${worst.c.headline}" 부터` : `"${worst.c.headline}" 성과가 부진해요`,
      count,
      reasonLine: reasonLineFor(status, top, worst.v.fakeEvidence),
      primaryAction,
    };
  }

  if (status === "cruising") {
    const count = actionable.filter((x) => x.v.status === "cruising").length;
    const top = worst.v.top;
    const primaryAction = top.kind === "increase-budget" && worst.c.adSetId
      ? { campaignId: worst.c.id, kind: "increase-budget" as const, toDailyBudget: top.toDailyBudget, label: "예산 늘리기" }
      : undefined;
    return {
      status,
      headline: count > 1 ? `호조 캠페인 ${count}건 — "${worst.c.headline}" 예산 증액을 검토해보세요` : `"${worst.c.headline}" 성과가 좋아요`,
      count,
      primaryAction,
    };
  }

  return { status: "stable", headline: "지금은 모든 캠페인이 안정적이에요", count: 0 };
}
