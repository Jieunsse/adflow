"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { type ToneId, type CtaId, type ImageId, type ObjectiveId, OUTCOME_TO_CTA } from "@entities/creative/options";
import type { ExtractedTargeting } from "@/lib/gemini-creative";

const INITIAL_HEADLINE = "피부가 먼저 느끼는 차이, 그린루틴";

export type OutcomeChip = ObjectiveId;
export type Objective = "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_AWARENESS" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_APP_PROMOTION";

export const OUTCOME_TO_OBJECTIVE: Record<OutcomeChip, Objective> = {
  traffic:       "OUTCOME_TRAFFIC",
  engagement:    "OUTCOME_ENGAGEMENT",
  awareness:     "OUTCOME_AWARENESS",
  leads:         "OUTCOME_LEADS",
  sales:         "OUTCOME_SALES",
  app_promotion: "OUTCOME_APP_PROMOTION",
};

export type CreativeState = {
  tone: ToneId;
  headline: string;
  cta: CtaId;
  image: ImageId;
  primaryText: string;
  generatedImages: [string, string, string] | null;
  targeting: ExtractedTargeting | null;
  outcomeChips: OutcomeChip[];
  outcomeHint: string;
  objective: Objective | null;
};

export type CreativeAction =
  | { type: "SET_TONE"; tone: ToneId }
  | { type: "SET_HEADLINE"; headline: string }
  | { type: "SET_IMAGE"; image: ImageId }
  | { type: "SET_PRIMARY_TEXT"; primaryText: string }
  | { type: "SET_GENERATED_IMAGES"; images: [string, string, string] }
  | { type: "SET_TARGETING"; targeting: ExtractedTargeting }
  | { type: "SET_OUTCOME_CHIP"; chip: OutcomeChip | null }
  | { type: "SET_OUTCOME_HINT"; hint: string }
  | { type: "SET_OBJECTIVE"; objective: Objective | null }
  | { type: "RESET" };

const INITIAL_STATE: CreativeState = {
  tone: "pro",
  headline: INITIAL_HEADLINE,
  cta: "sample",
  image: "img2",
  primaryText: "",
  generatedImages: null,
  targeting: null,
  outcomeChips: [],
  outcomeHint: "",
  objective: null,
};

function reducer(state: CreativeState, action: CreativeAction): CreativeState {
  switch (action.type) {
    case "SET_TONE":             return { ...state, tone: action.tone };
    case "SET_HEADLINE":         return { ...state, headline: action.headline };
    case "SET_IMAGE":            return { ...state, image: action.image };
    case "SET_PRIMARY_TEXT":     return { ...state, primaryText: action.primaryText };
    case "SET_GENERATED_IMAGES": return { ...state, generatedImages: action.images };
    case "SET_TARGETING":        return { ...state, targeting: action.targeting };
    case "SET_OUTCOME_CHIP": {
      if (!action.chip) return { ...state, outcomeChips: [], objective: null };
      const id = action.chip;
      if (state.outcomeChips.includes(id)) {
        const next = state.outcomeChips.filter((c) => c !== id);
        const primary = next[0];
        return { ...state, outcomeChips: next, objective: primary ? OUTCOME_TO_OBJECTIVE[primary] : null, cta: primary ? (OUTCOME_TO_CTA[primary] ?? state.cta) : state.cta };
      }
      if (state.outcomeChips.length >= 2) return state;
      const next = [...state.outcomeChips, id];
      return { ...state, outcomeChips: next, objective: OUTCOME_TO_OBJECTIVE[next[0]], cta: OUTCOME_TO_CTA[next[0]] ?? state.cta };
    }
    case "SET_OUTCOME_HINT":     return { ...state, outcomeHint: action.hint };
    case "SET_OBJECTIVE":        return { ...state, objective: action.objective };
    case "RESET":                return INITIAL_STATE;
    default:                     return state;
  }
}

type CreativeContextValue = { state: CreativeState; dispatch: Dispatch<CreativeAction> };
const CreativeContext = createContext<CreativeContextValue | null>(null);

export function CreativeStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return (
    <CreativeContext.Provider value={{ state, dispatch }}>
      {children}
    </CreativeContext.Provider>
  );
}

export function useCreativeDraft(): CreativeContextValue {
  const ctx = useContext(CreativeContext);
  if (!ctx) throw new Error("useCreativeDraft must be used inside CreativeStateProvider");
  return ctx;
}
