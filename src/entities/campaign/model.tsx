"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { gendersToUi, type Gender } from "@shared/lib/meta/targeting";
import type { CtaId, MetaObjective, ObjectivePhase1Id } from "@entities/creative/options";
import type { ExtractedTargeting } from "@/lib/gemini-creative";

export type LaunchMode = "simple" | "detailed";
export type BidStrategy = "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";
export type Placements = { mode: "auto" } | { mode: "manual"; positions: string[] };
export type AdPlatform = "both" | "facebook" | "instagram";
export type DeliveryStatus = "PAUSED" | "ACTIVE";

// PRD-objective-aware-launch §3 — awareness 의 빈도 캡. `{ impressions, days }` = 사용자당 N일에 최대 M회.
export type FrequencyCap = { impressions: number; days: number };
// leads_call 의 요일별 응대 시간대. day = 0(일)~6(토), start/end = "HH:MM".
export type CallScheduleSlot = { day: number; start: string; end: string };

// PRD-ab-testing.md §4.1 — A/B 시험 축 + 변형. Phase 1 = headline 만 실제 분기, primary_text·image 는 Phase 1.5/2 슬롯.
export type AbTestAxis = "headline" | "primary_text" | "image";
export type AbTestVariantB =
  | { axis: "headline"; headline: string }
  | { axis: "primary_text"; primaryText: string }
  | { axis: "image"; imageDataUrl: string };

// 결과 카드 좌·우 패널의 string label 추출 — 축별 union 분기.
export function abVariantLabel(variant: AbTestVariantB): string {
  if (variant.axis === "headline") return variant.headline;
  if (variant.axis === "primary_text") return variant.primaryText;
  return variant.imageDataUrl;
}

// `/api/campaign` POST 페이로드 — 캠페인 집행 요청.
export type LaunchParams = {
  headline: string;
  primaryText: string;
  dailyBudget: number; // KRW 정수 — 그대로 Meta 에 전달
  startDate: string;
  endDate: string;
  ageMin: number;
  ageMax: number;
  genders: number[];   // Meta 규격 — 1=남성, 2=여성, [] = 전체
  countries: string[]; // ISO 3166-1 alpha-2
  location?: string[]; // Persona 자유 태그 — V1 은 Meta API 시도 후 오류 시 폴백
  linkUrl: string;
  cta: CtaId;
  status: "ACTIVE" | "PAUSED";
  imageDataUrl?: string;
  objective?: MetaObjective;
  // PRD §13 — Phase 1 goal id (예: 'leads_call'). 서버에서 OBJECTIVES_PHASE1 entry 로 Meta config 도출.
  goalId?: ObjectivePhase1Id;
  mode?: LaunchMode;
  bidStrategy?: BidStrategy;
  bidAmount?: number;
  placements?: Placements;
  platforms?: AdPlatform;
  // PRD-ab-testing.md §4.2 — A/B 시험. enabled 면 axis + variantB 필수. Phase 1 = headline 만 실제 분기.
  abTestEnabled?: boolean;
  abTestAxis?: AbTestAxis;
  abTestVariantB?: AbTestVariantB;
  // Meta App 개발 모드 호환 — true 면 서버가 Campaign + AdSet 까지만 만들고 응답
  skipAdCreation?: boolean;
  // 캠페인 이름에 포함할 브랜드명 (Brand Profile 이름 또는 자유텍스트 앞 20자)
  brandName?: string;
};

// A/B 모드면 adIds 두 개. 단일 광고면 기존 adId. STEP 03 인사이트 분기에서 adIds 존재로 A/B 판정.
export type LaunchResponse = { campaignId: string; adSetId: string; adId?: string; adIds?: [string, string] };

export type LaunchedCampaign = {
  campaignId: string;
  adSetId: string;
  adId?: string;
  adIds?: [string, string];
  dailyBudget: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "PAUSED";
  objective?: "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_APP_PROMOTION";
  // PRD §13 — STEP 03 KpiGrid 가 goal 단위로 KPI 분기하려면 캠페인 객체에 goalId 저장 필요.
  goalId?: ObjectivePhase1Id;
  // Meta App 개발 모드 — Ad Creative/Ad 단계 skip 한 캠페인. STEP 03 차단·success card 분기에 사용
  skipped?: boolean;
  // PRD-ab-testing.md §10.1 — A/B 결과 카드 + prefill 용. adIds 가 있을 때만 의미. 헤드라인 축 = A 안 = headline.
  abTestAxis?: AbTestAxis;
  abTestVariantA?: string;
  abTestVariantB?: AbTestVariantB;
};

export type LaunchState = {
  mode: LaunchMode;
  platforms: AdPlatform;

  bidStrategy: BidStrategy;
  bidAmount: number | null;
  lookalikeEnabled: boolean;
  placements: Placements;
  autoPauseGuardrailEnabled: boolean;
  autoRelaunchEnabled: boolean;
  abTestEnabled: boolean;
  // PRD-ab-testing.md §4.1 — A/B 축 + B안. axis 변경 시 variantB null reset (invariant).
  abTestAxis: AbTestAxis | null;
  abTestVariantB: AbTestVariantB | null;

  // PRD-objective-aware-launch §3 — objective 종속 필드. 목표 변경 시 리셋(P2-b).
  frequencyCap: FrequencyCap | null;          // awareness 만
  callSchedule: CallScheduleSlot[];           // leads_call 만

  landingUrl: string;
  budget: string;              // 표시용 문자열 ("50,000")
  dateStart: string;           // YYYY-MM-DD
  dateEnd: string;             // YYYY-MM-DD
  ageMin: number;
  ageMax: number;
  gender: Gender;
  countries: string[];
  personaLocation: string[];
  delivery: DeliveryStatus;
  imageDataUrl: string | null;

  launchedCampaign: LaunchedCampaign | null;
};

export type LaunchAction =
  | { type: "SET_MODE"; mode: LaunchMode }
  | { type: "SET_PLATFORMS"; platforms: AdPlatform }
  | { type: "SET_BID_STRATEGY"; strategy: BidStrategy }
  | { type: "SET_BID_AMOUNT"; amount: number | null }
  | { type: "SET_LOOKALIKE_ENABLED"; enabled: boolean }
  | { type: "SET_PLACEMENTS"; placements: Placements }
  | { type: "SET_AUTO_PAUSE_GUARDRAIL"; enabled: boolean }
  | { type: "SET_AUTO_RELAUNCH_ENABLED"; enabled: boolean }
  | { type: "SET_AB_TEST_ENABLED"; enabled: boolean }
  | { type: "SET_AB_TEST_AXIS"; axis: AbTestAxis }
  | { type: "SET_AB_TEST_VARIANT_B"; value: AbTestVariantB | null }
  | { type: "SET_LANDING_URL"; value: string }
  | { type: "SET_FREQUENCY_CAP"; value: FrequencyCap | null }
  | { type: "SET_CALL_SCHEDULE"; value: CallScheduleSlot[] }
  // PRD-objective-aware-launch §5.2 — 목표 변경 시 호환 보존·종속 리셋.
  | { type: "MIGRATE_FOR_OBJECTIVE_CHANGE" }
  | { type: "SET_BUDGET"; value: string }
  | { type: "SET_DATE_START"; value: string }
  | { type: "SET_DATE_END"; value: string }
  | { type: "SET_AGE_RANGE"; min: number; max: number }
  | { type: "SET_GENDER"; value: Gender }
  | { type: "SET_COUNTRIES"; value: string[] }
  | { type: "SET_PERSONA_LOCATION"; value: string[] }
  | { type: "SET_DELIVERY"; value: DeliveryStatus }
  | { type: "SET_IMAGE_DATA_URL"; value: string | null }
  | { type: "SET_LAUNCHED_CAMPAIGN"; value: LaunchedCampaign }
  // Creative.targeting → LaunchDraft 의 age/gender prefill. STEP 02 진입 시점에 widget 이 1회 dispatch.
  | { type: "APPLY_CREATIVE_TARGETING"; targeting: ExtractedTargeting }
  | { type: "RESET" };

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// PRD-ab-testing.md §8.2 — 진행 중 작업 감지(`launchState !== INITIAL_LAUNCH_STATE`) 에 사용.
export const INITIAL_LAUNCH_STATE: LaunchState = {
  mode: "simple",
  platforms: "both",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  bidAmount: null,
  lookalikeEnabled: false,
  placements: { mode: "auto" },
  autoPauseGuardrailEnabled: false,
  autoRelaunchEnabled: false,
  abTestEnabled: false,
  abTestAxis: null,
  abTestVariantB: null,

  frequencyCap: null,
  callSchedule: [],

  landingUrl: "",
  budget: "50,000",
  dateStart: isoDate(0),
  dateEnd: isoDate(7),
  ageMin: 22,
  ageMax: 39,
  gender: "all",
  countries: ["KR"],
  personaLocation: [],
  delivery: "PAUSED",
  imageDataUrl: null,

  launchedCampaign: null,
};
const INITIAL_STATE = INITIAL_LAUNCH_STATE;


function reducer(state: LaunchState, action: LaunchAction): LaunchState {
  switch (action.type) {
    case "SET_MODE": {
      // 디테일 → 간단 전환 시 디테일 전용 필드 폐기 (PRD §5.2).
      // A/B 시험 토글·축·B안은 디테일 전용이라 모드 떠나면 의미 없음.
      if (state.mode === "detailed" && action.mode === "simple") {
        return { ...state, mode: action.mode, abTestEnabled: false, abTestAxis: null, abTestVariantB: null };
      }
      return { ...state, mode: action.mode };
    }
    case "SET_PLATFORMS":            return { ...state, platforms: action.platforms };
    case "SET_BID_STRATEGY":         return { ...state, bidStrategy: action.strategy };
    case "SET_BID_AMOUNT":           return { ...state, bidAmount: action.amount };
    case "SET_LOOKALIKE_ENABLED":    return { ...state, lookalikeEnabled: action.enabled };
    case "SET_PLACEMENTS":           return { ...state, placements: action.placements };
    case "SET_AUTO_PAUSE_GUARDRAIL": return { ...state, autoPauseGuardrailEnabled: action.enabled };
    case "SET_AUTO_RELAUNCH_ENABLED": return { ...state, autoRelaunchEnabled: action.enabled };
    case "SET_AB_TEST_ENABLED": {
      // 끄면 축·B안도 정리 — payload 에 의도치 않게 안 실리도록.
      if (!action.enabled) return { ...state, abTestEnabled: false, abTestAxis: null, abTestVariantB: null };
      // Phase 1 정책 — UI 에 축 라디오 없음. 켜면 headline 축으로 자동 시드 (PRD-ab-testing.md §3.1).
      return { ...state, abTestEnabled: true, abTestAxis: state.abTestAxis ?? "headline" };
    }
    case "SET_AB_TEST_AXIS": {
      // 축 변경 시 variantB null reset — invariant: variantB.axis === abTestAxis.
      if (state.abTestAxis === action.axis) return state;
      return { ...state, abTestAxis: action.axis, abTestVariantB: null };
    }
    case "SET_AB_TEST_VARIANT_B": return { ...state, abTestVariantB: action.value };
    case "SET_LANDING_URL":          return { ...state, landingUrl: action.value };
    case "SET_FREQUENCY_CAP":        return { ...state, frequencyCap: action.value };
    case "SET_CALL_SCHEDULE":        return { ...state, callSchedule: action.value };
    case "MIGRATE_FOR_OBJECTIVE_CHANGE": {
      // 호환(예산·일정·지역·연령·성별·관심사·A/B)은 보존, 종속(URL·고유 섹션 데이터)만 리셋.
      return { ...state, landingUrl: "", frequencyCap: null, callSchedule: [] };
    }
    case "SET_BUDGET":               return { ...state, budget: action.value };
    case "SET_DATE_START":           return { ...state, dateStart: action.value };
    case "SET_DATE_END":             return { ...state, dateEnd: action.value };
    case "SET_AGE_RANGE":            return { ...state, ageMin: action.min, ageMax: action.max };
    case "SET_GENDER":               return { ...state, gender: action.value };
    case "SET_COUNTRIES":            return { ...state, countries: action.value };
    case "SET_PERSONA_LOCATION":     return { ...state, personaLocation: action.value };
    case "SET_DELIVERY":             return { ...state, delivery: action.value };
    case "SET_IMAGE_DATA_URL":       return { ...state, imageDataUrl: action.value };
    case "SET_LAUNCHED_CAMPAIGN":    return { ...state, launchedCampaign: action.value };
    case "APPLY_CREATIVE_TARGETING": {
      const t = action.targeting;
      return { ...state, ageMin: t.ageMin, ageMax: t.ageMax, gender: gendersToUi(t.genders) };
    }
    case "RESET":                    return INITIAL_STATE;
    default:                         return state;
  }
}

type LaunchContextValue = { state: LaunchState; dispatch: Dispatch<LaunchAction> };
const LaunchContext = createContext<LaunchContextValue | null>(null);

export function LaunchStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return (
    <LaunchContext.Provider value={{ state, dispatch }}>
      {children}
    </LaunchContext.Provider>
  );
}

export function useLaunchDraft(): LaunchContextValue {
  const ctx = useContext(LaunchContext);
  if (!ctx) throw new Error("useLaunchDraft must be used inside LaunchStateProvider");
  return ctx;
}
