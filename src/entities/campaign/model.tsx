"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { Gender } from "@shared/lib/meta/targeting";

export type LaunchMode = "simple" | "detailed";
export type BidStrategy = "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";
export type Placements = { mode: "auto" } | { mode: "manual"; positions: string[] };
export type AdPlatform = "both" | "facebook" | "instagram";
export type DeliveryStatus = "PAUSED" | "ACTIVE";

export type LaunchedCampaign = {
  campaignId: string;
  adSetId: string;
  adId?: string;
  dailyBudget: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "PAUSED";
  objective?: "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_APP_PROMOTION";
  // Meta App 개발 모드 — Ad Creative/Ad 단계 skip 한 캠페인. STEP 03 차단·success card 분기에 사용
  skipped?: boolean;
};

export type LaunchState = {
  mode: LaunchMode;
  platforms: AdPlatform;

  bidStrategy: BidStrategy;
  bidAmount: number | null;
  customAudienceIds: string[];
  lookalikeEnabled: boolean;
  placements: Placements;
  autoPauseGuardrailEnabled: boolean;
  abTestEnabled: boolean;

  landingUrl: string;
  budget: string;              // 표시용 문자열 ("50,000")
  dateStart: string;           // YYYY-MM-DD
  dateEnd: string;             // YYYY-MM-DD
  ageMin: number;
  ageMax: number;
  gender: Gender;
  countries: string[];
  delivery: DeliveryStatus;
  imageDataUrl: string | null;

  launchedCampaign: LaunchedCampaign | null;
};

export type LaunchAction =
  | { type: "SET_MODE"; mode: LaunchMode }
  | { type: "SET_PLATFORMS"; platforms: AdPlatform }
  | { type: "SET_BID_STRATEGY"; strategy: BidStrategy }
  | { type: "SET_BID_AMOUNT"; amount: number | null }
  | { type: "SET_CUSTOM_AUDIENCES"; ids: string[] }
  | { type: "SET_LOOKALIKE_ENABLED"; enabled: boolean }
  | { type: "SET_PLACEMENTS"; placements: Placements }
  | { type: "SET_AUTO_PAUSE_GUARDRAIL"; enabled: boolean }
  | { type: "SET_AB_TEST_ENABLED"; enabled: boolean }
  | { type: "SET_LANDING_URL"; value: string }
  | { type: "SET_BUDGET"; value: string }
  | { type: "SET_DATE_START"; value: string }
  | { type: "SET_DATE_END"; value: string }
  | { type: "SET_AGE_RANGE"; min: number; max: number }
  | { type: "SET_GENDER"; value: Gender }
  | { type: "SET_COUNTRIES"; value: string[] }
  | { type: "SET_DELIVERY"; value: DeliveryStatus }
  | { type: "SET_IMAGE_DATA_URL"; value: string | null }
  | { type: "SET_LAUNCHED_CAMPAIGN"; value: LaunchedCampaign }
  | { type: "RESET" };

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const INITIAL_STATE: LaunchState = {
  mode: "simple",
  platforms: "both",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  bidAmount: null,
  customAudienceIds: [],
  lookalikeEnabled: false,
  placements: { mode: "auto" },
  autoPauseGuardrailEnabled: false,
  abTestEnabled: false,

  landingUrl: "",
  budget: "50,000",
  dateStart: isoDate(0),
  dateEnd: isoDate(7),
  ageMin: 22,
  ageMax: 39,
  gender: "all",
  countries: ["KR"],
  delivery: "PAUSED",
  imageDataUrl: null,

  launchedCampaign: null,
};


function reducer(state: LaunchState, action: LaunchAction): LaunchState {
  switch (action.type) {
    case "SET_MODE":                 return { ...state, mode: action.mode };
    case "SET_PLATFORMS":            return { ...state, platforms: action.platforms };
    case "SET_BID_STRATEGY":         return { ...state, bidStrategy: action.strategy };
    case "SET_BID_AMOUNT":           return { ...state, bidAmount: action.amount };
    case "SET_CUSTOM_AUDIENCES":     return { ...state, customAudienceIds: action.ids };
    case "SET_LOOKALIKE_ENABLED":    return { ...state, lookalikeEnabled: action.enabled };
    case "SET_PLACEMENTS":           return { ...state, placements: action.placements };
    case "SET_AUTO_PAUSE_GUARDRAIL": return { ...state, autoPauseGuardrailEnabled: action.enabled };
    case "SET_AB_TEST_ENABLED":      return { ...state, abTestEnabled: action.enabled };
    case "SET_LANDING_URL":          return { ...state, landingUrl: action.value };
    case "SET_BUDGET":               return { ...state, budget: action.value };
    case "SET_DATE_START":           return { ...state, dateStart: action.value };
    case "SET_DATE_END":             return { ...state, dateEnd: action.value };
    case "SET_AGE_RANGE":            return { ...state, ageMin: action.min, ageMax: action.max };
    case "SET_GENDER":               return { ...state, gender: action.value };
    case "SET_COUNTRIES":            return { ...state, countries: action.value };
    case "SET_DELIVERY":             return { ...state, delivery: action.value };
    case "SET_IMAGE_DATA_URL":       return { ...state, imageDataUrl: action.value };
    case "SET_LAUNCHED_CAMPAIGN":    return { ...state, launchedCampaign: action.value };
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
