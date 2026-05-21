"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { type ToneId, type CtaId, type ImageId, type Objective, type OutcomeChip } from "@entities/creative/options";
import { selectOutcome } from "@entities/creative/outcome-routing";
import type { ExtractedTargeting } from "@/lib/gemini-creative";

const INITIAL_HEADLINE = "피부가 먼저 느끼는 차이, 그린루틴";

// PRD §13.10 — 광고 목표는 STEP 01 single-select. multi-select 와 outcomeChips array 는 폐기.
export type CreativeState = {
  tone: ToneId;
  headline: string;
  cta: CtaId;
  image: ImageId;
  primaryText: string;
  generatedImages: [string, string, string] | null;
  targeting: ExtractedTargeting | null;
  outcome: OutcomeChip | null;
  outcomeHint: string;
  objective: Objective | null;
  // Gemini 가 만든 raw 헤드라인 후보 3개 — STEP 02 디테일 A/B 시험의 B안 풀로 사용.
  // headline 은 그중 1개 선택 결과.
  headlineCandidates: string[] | null;
  // Gemini 가 만든 primaryText 후보 3개 — STEP 02 카피문구 A/B 시험의 B안 풀로 사용.
  primaryTextCandidates: string[] | null;
  // PRD-objective-aware-launch §5.2 — outcome 변경 시 직전 outcome 을 stash.
  // STEP 01 카피 stale 배너에서 사용. 새 카피 생성 시 또는 원위치 복귀 시 null 로 clear.
  previousOutcome: OutcomeChip | null;
};

export type CreativeAction =
  | { type: "SET_TONE"; tone: ToneId }
  | { type: "SET_HEADLINE"; headline: string }
  | { type: "SET_IMAGE"; image: ImageId }
  | { type: "SET_PRIMARY_TEXT"; primaryText: string }
  | { type: "SET_GENERATED_IMAGES"; images: [string, string, string] }
  | { type: "SET_TARGETING"; targeting: ExtractedTargeting }
  // PRD-objective-aware-launch §3 — traffic/engagement 에서 사용자가 CTA 직접 선택.
  | { type: "SET_CTA"; cta: CtaId }
  | { type: "SET_OUTCOME"; outcome: OutcomeChip | null }
  | { type: "SET_OUTCOME_HINT"; hint: string }
  | { type: "SET_HEADLINE_CANDIDATES"; candidates: string[] | null }
  | { type: "SET_PRIMARY_TEXT_CANDIDATES"; candidates: string[] | null }
  | { type: "CLEAR_PREVIOUS_OUTCOME" }
  | { type: "RESET" };

// PRD-ab-testing.md §8.2 — 진행 중 작업 감지(`creativeState !== INITIAL_CREATIVE_STATE`) 에 사용.
export const INITIAL_CREATIVE_STATE: CreativeState = {
  tone: "pro",
  headline: INITIAL_HEADLINE,
  cta: "sample",
  image: "img2",
  primaryText: "",
  generatedImages: null,
  targeting: null,
  outcome: null,
  outcomeHint: "",
  objective: null,
  headlineCandidates: null,
  primaryTextCandidates: null,
  previousOutcome: null,
};
const INITIAL_STATE = INITIAL_CREATIVE_STATE;

function reducer(state: CreativeState, action: CreativeAction): CreativeState {
  switch (action.type) {
    case "SET_TONE":             return { ...state, tone: action.tone };
    case "SET_HEADLINE":         return { ...state, headline: action.headline };
    case "SET_IMAGE":            return { ...state, image: action.image };
    case "SET_PRIMARY_TEXT":     return { ...state, primaryText: action.primaryText };
    case "SET_GENERATED_IMAGES": return { ...state, generatedImages: action.images };
    case "SET_TARGETING":        return { ...state, targeting: action.targeting };
    case "SET_CTA":              return { ...state, cta: action.cta };
    case "SET_OUTCOME": {
      const { outcome, objective, cta } = selectOutcome(state.outcome, action.outcome, state.cta);
      // outcome 변경 시 prev stash. 원위치 복귀(action.outcome === previousOutcome)면 stash 해제.
      const changed = state.outcome !== null && outcome !== null && state.outcome !== outcome;
      const revertedToPrev = outcome !== null && outcome === state.previousOutcome;
      const nextPrev = revertedToPrev ? null : changed ? state.outcome : state.previousOutcome;
      return { ...state, outcome, objective, cta, previousOutcome: nextPrev };
    }
    case "SET_OUTCOME_HINT":     return { ...state, outcomeHint: action.hint };
    // 새 카피 생성 = stale 해제 — SET_HEADLINE_CANDIDATES 시점에 previousOutcome 자동 clear.
    case "SET_HEADLINE_CANDIDATES": return { ...state, headlineCandidates: action.candidates, previousOutcome: null };
    case "SET_PRIMARY_TEXT_CANDIDATES": return { ...state, primaryTextCandidates: action.candidates };
    case "CLEAR_PREVIOUS_OUTCOME": return { ...state, previousOutcome: null };
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
