// A/B 토너먼트 목표별 결정 지표 (ADR-037 V2) — server-safe 순수 모듈.
// 토너먼트 셋업 "광고 목표"가 traffic 외 인지도·참여·행동유도(통화)로 확장되면 승자 판정 지표가 달라진다:
//   traffic/engagement/leads_call = action 비율(클릭·참여·통화 / 노출) 이 높을수록 우세 (kind: "rate")
//   awareness                     = CPM(노출 천 회당 비용) 이 낮을수록 우세 (kind: "cpm")
// engine.ts(시뮬·판정)·report.ts(표시 신뢰도)·상세 화면이 이 spec 하나를 공유해 분기를 한 곳에 모은다.
// "use client" 없음 — 서버 cron·라우트도 import 한다.

import { GOAL_RESULT, type ObjectivePhase1Id } from "@entities/creative/options";

export type TourMetricKind = "rate" | "cpm";

export type TourMetricSpec = {
  id: ObjectivePhase1Id;
  kind: TourMetricKind;
  rateLabel: string; // 라운드 카드 헤드라인 지표명 (CTR·참여율·통화율·CPM)
  actionNoun: string; // 결과 명사 (클릭·참여·통화·노출)
  costLabel: string; // 단가 라벨 (CPC·참여당 비용·…·CPM)
  seedDefault: number; // 출발 챔피언 기준선 — rate=비율%, cpm=원
  higherBetter: boolean; // 헤드라인 지표가 높을수록 우세인지 (cpm 은 false)
  leadEpsilon: number; // "우세 ▲" 표시 최소 격차 (rate=%, cpm=원)
};

// 셋업 드롭다운 목표 — 모두 Phase 1 goalId 라 실 launcher·insights 가 추가 작업 없이 게재·판정한다.
// (leads 폼/판매 전환은 별도 설정이 필요해 토너먼트 범위 밖 — 행동유도는 통화 goal 로 매핑.)
const SPECS: Record<string, TourMetricSpec> = {
  traffic: {
    id: "traffic", kind: "rate", rateLabel: "CTR",
    actionNoun: GOAL_RESULT.traffic.noun, costLabel: GOAL_RESULT.traffic.costLabel,
    seedDefault: 1.8, higherBetter: true, leadEpsilon: 0.01,
  },
  awareness: {
    id: "awareness", kind: "cpm", rateLabel: "CPM",
    actionNoun: GOAL_RESULT.awareness.noun, costLabel: GOAL_RESULT.awareness.costLabel,
    seedDefault: 8000, higherBetter: false, leadEpsilon: 30,
  },
  engagement: {
    id: "engagement", kind: "rate", rateLabel: "참여율",
    actionNoun: GOAL_RESULT.engagement.noun, costLabel: GOAL_RESULT.engagement.costLabel,
    seedDefault: 1.8, higherBetter: true, leadEpsilon: 0.01,
  },
  leads_call: {
    id: "leads_call", kind: "rate", rateLabel: "통화율",
    actionNoun: GOAL_RESULT.leads_call.noun, costLabel: GOAL_RESULT.leads_call.costLabel,
    seedDefault: 1.8, higherBetter: true, leadEpsilon: 0.01,
  },
};

// 셋업 드롭다운 옵션 (사용자 노출 라벨). value = goalId.
export const TOUR_OBJECTIVE_OPTIONS: { value: string; label: string }[] = [
  { value: "traffic", label: "사이트 방문 유도" },
  { value: "awareness", label: "브랜드 알리기" },
  { value: "engagement", label: "참여 늘리기" },
  { value: "leads_call", label: "행동 유도" },
];

export function tourMetricSpec(objective: string): TourMetricSpec {
  return SPECS[objective] ?? SPECS.traffic;
}

export function metricCpm(ad: { spend: number; impressions: number }): number {
  return ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0;
}

// 라운드 카드 헤드라인 지표값 — rate=action 비율%, cpm=CPM 원.
export function primaryMetricValue(
  spec: TourMetricSpec,
  ad: { ctr: number; cpm?: number; spend: number; impressions: number },
): number {
  return spec.kind === "cpm" ? (ad.cpm ?? metricCpm(ad)) : ad.ctr;
}

export function formatPrimary(spec: TourMetricSpec, value: number): string {
  return spec.kind === "cpm"
    ? `₩${Math.round(value).toLocaleString("ko-KR")}`
    : `${value.toFixed(2)}%`;
}

// self 가 우세하면 양수 — rate=높을수록 / cpm=낮을수록 우세.
export function primaryDelta(spec: TourMetricSpec, self: number, other: number): number {
  return spec.higherBetter ? self - other : other - self;
}
