// ADR-033 — Browse Mode(둘러보기) 시연 전용 캠페인 모델. 실제 LaunchedCampaign 와 분리된 namespace.
// 성과는 baseDaily* 비율 × fastForwardDays 로 결정적 생성 (./insights.ts).

import type { MetaObjectiveParam } from "@/lib/meta-ads";
import type { KpiTarget } from "@entities/insights/winner-types";

export type BrowseStatus = "live" | "paused" | "ended";

// ADR-034 — Auto-Pilot(AI 자동 운영). 부진 대응 정책은 확인 모달에서 선택.
export type AutomationPolicy = "decrease" | "pause";

export type AutoPilotAction = {
  atDay: number; // 조치 시점(fastForwardDays 프런티어)
  kind: "increase-budget" | "decrease-budget" | "pause";
  detail: string;
  fromBudget?: number;
  toBudget?: number;
};

export type BrowseCampaign = {
  id: string;
  name: string;
  headline: string;
  primaryText: string;
  cta: string;
  imagePrompt: string;
  imageUrl: string;
  objective: MetaObjectiveParam;
  dailyBudget: number;

  // 결정적 성과 생성용 일평균 기준치.
  baseDailyImpressions: number;
  baseDailyClicks: number;
  baseDailySpend: number;

  startDate: string; // 시드 시점(YYYY-MM-DD)
  endDate?: string;
  landingUrl?: string;
  status: BrowseStatus;
  fastForwardDays: number; // 빨리감기 단일 소스 — 누적 일수

  // 예산 증액 변곡점 — 미래만 반영(계단식). dailyBudget 은 baseline 유지, 현재 예산은 파생.
  // atDay 이상 일자의 볼륨이 dailyBudget/baseline 비율로 스케일된다 (CTR·CPC 불변).
  budgetChanges?: { atDay: number; dailyBudget: number }[];

  kpiTarget?: KpiTarget[];

  // ADR-034 — Auto-Pilot. 켜면 Fast-Forward 틱마다 성과를 평가해 예산·정지를 자동 적용.
  automationOn?: boolean;
  automationPolicy?: AutomationPolicy; // 부진 시 대응
  autoActions?: AutoPilotAction[]; // AI 조치 로그 — 준비도 카드·알림이 읽음

  // 자동 재게재 체인.
  parentId?: string;
  cycle: number;

  ageMin: number;
  ageMax: number;
  genders: number[];
  countries: string[];

  createdAt: string;
};
