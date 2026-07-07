// PRD-influencer-marketing.md §5 — 크리에이터 장부. 유저 입력 + 협업 성과 누적.
// followerCount·performanceHistory 는 실측(Meta API)이 아닌 유저 입력값 — UI 에 "직접 입력" 명시(§8).

export type CreatorPlatform = "instagram" | "youtube" | "tiktok" | "other";

export interface Creator {
  id: string;
  handle: string; // @핸들 (플랫폼 무관 문자열, V1 검증 안 함)
  platform: CreatorPlatform;
  displayName?: string;
  avatarUrl?: string;
  category: string[]; // 뷰티·푸드 등 태그
  followerCount?: number; // 유저 입력(실측 아님)
  note?: string;
  performanceHistory: CreatorPerformance[]; // 피드백 루프 입력. AI 미개입.
  createdAt: string;
}

// 한 캠페인에서 이 크리에이터가 낸 실측 성과 (전부 수동 입력)
export interface CreatorPerformance {
  campaignId: string;
  reach?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number; // 있으면만 ROAS 계산, 없으면 미표시
  cost?: number; // 협업비 (지급 기록)
  recordedAt: string;
}

// 랭킹 결과 (파생, 저장 안 함)
export interface CreatorRankResult {
  creator: Creator;
  score: number;
  reasons: string[]; // "카테고리 적합" · "지난 캠페인 전환 상위" 등 근거 칩
}
