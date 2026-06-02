// 플로(Flo) 공유 타입 — 클라(위젯·페이지)·서버(라우트·gather·briefing) 양쪽이 쓴다. (ADR-045)

import type { ClaudeModel } from "@/lib/claude-client";

// 공급자 선택 (유저 토글). Claude 2종 + Gemini. 기본 sonnet.
export type FloModel = ClaudeModel | "gemini"; // "sonnet" | "opus" | "gemini"

export type FindingSeverity = "good" | "info" | "warn";

export interface FindingAction {
  label: string;
  href: string; // /create · /ab-tests · /brand-profile · /campaigns …
}

export interface Finding {
  severity: FindingSeverity;
  title: string;
  diagnosis: string; // 왜 — 우리가 계산한 신호만 인용
  suggestion: string; // 권장 조치
  alternative?: string; // 대안 (있으면)
  action?: FindingAction; // 조언 → 행동 딥링크
}

export interface Briefing {
  id: string;
  adAccountId: string; // 활성 광고 계정 키 (browse 게스트는 'browse')
  model: FloModel;
  headline: string;
  findings: Finding[];
  createdAt: string;
}

/* ── gather 단계 산출(서버 내부) — 5소스 요약 + 룰 판정 ── */

export interface FloBrandFact {
  name?: string;
  tone?: string;
  brandVoice?: string;
  brandDescription?: string;
  proofPoints?: string[];
}

export interface FloCampaignFact {
  headline: string;
  objective: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number; // %
  spend: number; // KRW
  dailyBudget: number | null;
  fakePerformance: string | null; // 우리가 계산한 가짜성과 의심 판정 텍스트 (없으면 null)
}

export interface FloChannelFact {
  channel: "instagram" | "facebook";
  followers: number;
  engagementRate: number; // %
  suggestions: string[]; // suggestChannelOptimizations 가 낸 제목들 (룰 판정)
}

export interface FloTournamentFact {
  productName: string;
  objective: string;
  round: number;
  latestVerdict?: string;
}

export interface FloContext {
  adAccountId: string;
  campaigns: FloCampaignFact[];
  instagram?: FloChannelFact;
  facebook?: FloChannelFact;
  tournaments: FloTournamentFact[];
  brand?: FloBrandFact;
}
