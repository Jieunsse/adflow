"use client";

// Browse 캠페인 시드 + 재게재 자식 생성. 실제 Meta 게재 없이 store 에만 기록 (정직한 mock 이음매).
// 실제 /create 의 browseMode launch 가 createBrowseCampaign 을 호출 — 사용자가 만든 소재·타겟·예산을 보존하고,
// 성과 기준치(baseDaily*)만 winner-grade 비율(BROWSE_SEED)로 예산에 비례 시드한다.

import type { MetaObjectiveParam } from "@/lib/meta-ads";
import type { KpiTarget } from "@entities/insights/winner-types";
import type { BrowseCampaign } from "./types";
import { getBrowse, upsertBrowse } from "./store";
import { DEMO_HEADLINES, DEMO_PRIMARY_TEXTS, DEMO_CTA, DEMO_IMAGE_PROMPT, DEMO_IMAGES } from "@/lib/demo/content";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(): string {
  return `browse_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// winner 급 트래픽 캠페인 시드 템플릿 — 일평균 CTR≈2.4%, CPC≈₩594(< ₩2,000), dailyBudget 50,000 기준.
// 시드 직후 fastForwardDays=2: 성과는 보이되 MIN_DAYS(3) 미달이라 아직 winner 아님 → 빨리감기로 검증 유도.
// 정적 메트릭은 상수로 분리 — insights.test.ts 가 isWinner thresholds 와의 결합을 검증할 때 재사용.
export const BROWSE_SEED = {
  name: "Browse 시연 — 비건 수분 크림",
  headline: DEMO_HEADLINES[0],
  primaryText: DEMO_PRIMARY_TEXTS[0].text,
  cta: DEMO_CTA,
  imagePrompt: DEMO_IMAGE_PROMPT,
  imageUrl: DEMO_IMAGES[0],
  objective: "OUTCOME_TRAFFIC",
  dailyBudget: 50000,
  baseDailyImpressions: 4200,
  baseDailyClicks: 101, // 101/4200 ≈ 2.40%
  baseDailySpend: 60000, // 60000/101 ≈ ₩594/클릭
  status: "live",
  fastForwardDays: 2,
  cycle: 1,
  ageMin: 20,
  ageMax: 40,
  genders: [],
  countries: ["KR"],
} satisfies Omit<BrowseCampaign, "id" | "startDate" | "createdAt">;

export type BrowseCampaignInput = {
  id?: string; // launch 가 발급한 campaignId 와 일치시킬 때 전달
  name: string;
  headline: string;
  primaryText: string;
  cta: string;
  imageUrl: string;
  imagePrompt?: string;
  objective: MetaObjectiveParam;
  dailyBudget: number;
  startDate?: string;
  endDate?: string;
  landingUrl?: string;
  status?: BrowseCampaign["status"];
  ageMin: number;
  ageMax: number;
  genders: number[];
  countries: string[];
  kpiTarget?: KpiTarget[];
};

// 실제 launch 파라미터로 Browse 캠페인 생성 — 소재·타겟·예산은 보존, baseDaily* 만 BROWSE_SEED 비율로 예산 스케일.
export function createBrowseCampaign(input: BrowseCampaignInput): string {
  const id = input.id ?? newId();
  const scale = input.dailyBudget > 0 ? input.dailyBudget / BROWSE_SEED.dailyBudget : 1;
  const camp: BrowseCampaign = {
    id,
    name: input.name,
    headline: input.headline,
    primaryText: input.primaryText,
    cta: input.cta,
    imagePrompt: input.imagePrompt ?? BROWSE_SEED.imagePrompt,
    imageUrl: input.imageUrl || BROWSE_SEED.imageUrl,
    objective: input.objective,
    dailyBudget: input.dailyBudget,
    baseDailyImpressions: Math.round(BROWSE_SEED.baseDailyImpressions * scale),
    baseDailyClicks: Math.round(BROWSE_SEED.baseDailyClicks * scale),
    baseDailySpend: Math.round(BROWSE_SEED.baseDailySpend * scale),
    startDate: input.startDate ?? today(),
    endDate: input.endDate,
    landingUrl: input.landingUrl,
    status: input.status ?? "live",
    fastForwardDays: BROWSE_SEED.fastForwardDays,
    kpiTarget: input.kpiTarget,
    cycle: 1,
    ageMin: input.ageMin,
    ageMax: input.ageMax,
    genders: input.genders,
    countries: input.countries,
    createdAt: new Date().toISOString(),
  };
  upsertBrowse(camp);
  return id;
}

// ADR-034 — Auto-Pilot 데모용 고정 시드 2개(호조/망조). 발표자가 목록에서 골라 들어가 자동 운영을 시연.
// fastForwardDays=2 로 시작 → 준비도 미달, 빨리감기로 "자동화 준비 완료" 도달 후 켜기 유도(BROWSE_SEED 와 동일 arc).
const AUTOPILOT_WIN_ID = "browse_demo_autopilot_win";
const AUTOPILOT_LOW_ID = "browse_demo_autopilot_low";

function autoPilotSeed(
  id: string,
  name: string,
  headline: string,
  primaryText: string,
  imageUrl: string,
  metrics: { baseDailyImpressions: number; baseDailyClicks: number; baseDailySpend: number },
): BrowseCampaign {
  return {
    id,
    name,
    headline,
    primaryText,
    cta: DEMO_CTA,
    imagePrompt: DEMO_IMAGE_PROMPT,
    imageUrl,
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 50000,
    ...metrics,
    startDate: today(),
    status: "live",
    fastForwardDays: 2,
    cycle: 1,
    ageMin: 20,
    ageMax: 40,
    genders: [],
    countries: ["KR"],
    createdAt: new Date().toISOString(),
  };
}

// 멱등 — 이미 있으면 건드리지 않음. /campaigns 목록(browseMode) 진입 시 호출.
export function seedAutoPilotDemo(): void {
  if (!getBrowse(AUTOPILOT_WIN_ID)) {
    upsertBrowse(autoPilotSeed(
      AUTOPILOT_WIN_ID,
      "여름 수분 크림 — 성과 우수 시연",
      DEMO_HEADLINES[0],
      DEMO_PRIMARY_TEXTS[0].text,
      DEMO_IMAGES[0],
      { baseDailyImpressions: 4200, baseDailyClicks: 101, baseDailySpend: 60000 }, // CTR≈2.40% → Winner 기준 통과
    ));
  }
  if (!getBrowse(AUTOPILOT_LOW_ID)) {
    upsertBrowse(autoPilotSeed(
      AUTOPILOT_LOW_ID,
      "가을 진정 세럼 — 성과 아쉬움 시연",
      DEMO_HEADLINES[2],
      DEMO_PRIMARY_TEXTS[1].text,
      DEMO_IMAGES[Math.min(2, DEMO_IMAGES.length - 1)],
      { baseDailyImpressions: 4200, baseDailyClicks: 50, baseDailySpend: 55000 }, // CTR≈1.19%(준비 OK·Winner 미달), CPC≈₩1,100
    ));
  }
}

// 재게재 자식 — 부모 내용 100% 복제, cycle+1, status live, fastForward 0 부터 다시.
// useAutoRelaunch().inheritFromParent 는 호출 측(컴포넌트)에서 별도로 호출.
export function createBrowseRelaunchChild(parentId: string): string | null {
  const parent = getBrowse(parentId);
  if (!parent) return null;
  const cycle = parent.cycle + 1;
  const baseName = parent.name.replace(/ \(자동 재게재 #\d+\)$/, "");
  const id = newId();
  const child: BrowseCampaign = {
    ...parent,
    id,
    name: `${baseName} (자동 재게재 #${cycle})`,
    status: "live",
    fastForwardDays: 0,
    parentId,
    cycle,
    startDate: today(),
    createdAt: new Date().toISOString(),
  };
  upsertBrowse(child);
  return id;
}
