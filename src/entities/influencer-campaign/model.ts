// PRD-influencer-marketing.md §5 — 인플루언서 캠페인 + 파이프라인. Meta Campaign 과 별개 엔티티(ADR-065 §1).

import type { CreatorPerformance } from "@entities/creator/model";

export const STAGE_ORDER = [
  "candidate",
  "proposed",
  "negotiating",
  "producing",
  "published",
  "settled",
] as const;

export type CampaignStage = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<CampaignStage, string> = {
  candidate: "후보",
  proposed: "제안함",
  negotiating: "논의 중",
  producing: "촬영 중",
  published: "게시됨",
  settled: "정산",
};

// 파이프라인 한 칸 = 이 캠페인 × 이 크리에이터
export interface CampaignEntry {
  creatorId: string;
  stage: CampaignStage;
  outreachDraft?: string; // 마지막 생성 제안 초안(편집본 보존)
  contentGuideline?: string; // 마지막 생성 가이드라인
  contentUrl?: string; // 게시된 결과물 URL (검수 코멘트 입력)
  performance?: CreatorPerformance; // 이 캠페인에서의 실측 (=Creator.performanceHistory 로도 투영)
  paidAt?: string; // 정산(지급 기록) 시각 — 돈 안 옮김
  updatedAt: string;
}

// 인플루언서 캠페인 (Meta Campaign 과 별개 엔티티)
export interface InfluencerCampaign {
  id: string;
  name: string;
  goal: string; // 자유 텍스트/칩 (Meta objective 아님)
  productId?: string; // Brand Profile Product(ADR-024) 연계
  budget?: number;
  startDate?: string;
  endDate?: string;
  brandProfileId: string; // 랭킹·초안 컨텍스트 소스
  entries: CampaignEntry[]; // 파이프라인에 담긴 크리에이터들
  createdAt: string;
}

// 완료 판정 — entries 1개 이상 + 전부 정산. 목록 탭·/creators KPI 가 동일 기준을 공유(PKG-E).
export function isCampaignCompleted(campaign: InfluencerCampaign): boolean {
  return campaign.entries.length > 0 && campaign.entries.every((e) => e.stage === "settled");
}
