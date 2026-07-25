// P0 — /create 초안 전면 휘발 방지. Creative/Launch state + step + 스튜디오 로컬 상태(카피 후보)를
// sessionStorage 에 미러링해 라우트 이탈·새로고침으로 생성 결과·게재 설정이 소실되지 않게 한다.
// 순수 직렬화(테스트 대상)와 storage IO(try/catch, 브라우저 전용)를 분리.

import type { CreativeState, CreativeAction } from "./model";
import type { CopyHook, OutcomeChip } from "./options";
import type { LaunchState, LaunchAction } from "@entities/campaign/model";

export const DRAFT_STORAGE_KEY = "adflow_create_draft_v1";

// page.tsx 로컬 useState 로만 존재하는 생성 결과 — reducer 밖이라 별도 스냅샷 필요.
// 이게 없으면 복원해도 generated=false 로 스튜디오 게이트가 다시 막힌다.
export type StudioSnapshot = {
  displayedHeadlines: string[] | null;
  displayedSubtitles: string[] | null;
  headlineIdx: number;
  displayedPrimaryTexts: [string, string, string] | null;
  displayedHooks: [CopyHook, CopyHook, CopyHook] | null;
  proofPointsCited: [boolean, boolean, boolean] | null;
  primaryTextIdx: number;
  hooks: CopyHook[];
  generatedForOutcome: OutcomeChip | null;
};

export type CreateDraftSnapshot = {
  step: number;
  creative: CreativeState;
  launch: LaunchState;
  studio: StudioSnapshot;
  savedAt: number;
};

export function serializeDraft(step: number, creative: CreativeState, launch: LaunchState, studio: StudioSnapshot): string {
  const snapshot: CreateDraftSnapshot = { step, creative, launch, studio, savedAt: Date.now() };
  return JSON.stringify(snapshot);
}

export function parseDraft(raw: string): CreateDraftSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CreateDraftSnapshot>;
    if (!parsed || typeof parsed !== "object" || !parsed.creative || !parsed.launch || !parsed.studio) return null;
    return parsed as CreateDraftSnapshot;
  } catch {
    return null;
  }
}

// 쿼터 초과 시 이미지 필드(가장 큰 원인)만 생략하고 재시도 — 나머지 값은 지킨다.
function withoutImages(launch: LaunchState): LaunchState {
  return { ...launch, imageDataUrl: null, finalImageDataUrl: null };
}

export function saveDraftToSession(step: number, creative: CreativeState, launch: LaunchState, studio: StudioSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, serializeDraft(step, creative, launch, studio));
  } catch {
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, serializeDraft(step, creative, withoutImages(launch), studio));
    } catch {
      /* sessionStorage 사용 불가 — 초안 저장 skip */
    }
  }
}

export function loadDraftFromSession(): CreateDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  return parseDraft(raw);
}

export function clearDraftFromSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}

type Dispatcher<A> = (action: A) => void;

// 저장 스냅샷 → 기존 액션 시퀀스로 재구성. 새 HYDRATE 액션 없이 reducer invariant
// (SET_OUTCOME 의 objective/cta 파생, A/B enabled→axis→variantB 순서)를 그대로 지킨다.
export function hydrateCreativeDraft(dispatch: Dispatcher<CreativeAction>, s: CreativeState): void {
  dispatch({ type: "RESET" });
  if (s.outcome) dispatch({ type: "SET_OUTCOME", outcome: s.outcome });
  dispatch({ type: "SET_TONE", tone: s.tone });
  dispatch({ type: "SET_HEADLINE", headline: s.headline });
  dispatch({ type: "SET_SUBTITLE", subtitle: s.subtitle });
  dispatch({ type: "SET_CTA", cta: s.cta });
  dispatch({ type: "SET_IMAGE", image: s.image });
  dispatch({ type: "SET_PRIMARY_TEXT", primaryText: s.primaryText });
  if (s.generatedImages) dispatch({ type: "SET_GENERATED_IMAGES", images: s.generatedImages });
  if (s.targeting) dispatch({ type: "SET_TARGETING", targeting: s.targeting });
  dispatch({ type: "SET_TARGETING_SOURCE", source: s.targetingSource });
  dispatch({ type: "SET_OUTCOME_HINT", hint: s.outcomeHint });
  dispatch({ type: "SET_HEADLINE_CANDIDATES", candidates: s.headlineCandidates });
  dispatch({ type: "SET_PRIMARY_TEXT_CANDIDATES", candidates: s.primaryTextCandidates });
  dispatch({ type: "SET_SUBTITLE_CANDIDATES", candidates: s.subtitleCandidates });
  dispatch({ type: "SET_OVERLAY_HEADLINES", headlines: s.overlayHeadlines });
}

export function hydrateLaunchDraft(dispatch: Dispatcher<LaunchAction>, s: LaunchState): void {
  dispatch({ type: "RESET" });
  dispatch({ type: "SET_MODE", mode: s.mode });
  dispatch({ type: "SET_PLATFORMS", platforms: s.platforms });
  dispatch({ type: "SET_BID_STRATEGY", strategy: s.bidStrategy });
  dispatch({ type: "SET_BID_AMOUNT", amount: s.bidAmount });
  dispatch({ type: "SET_CUSTOM_AUDIENCE", value: s.customAudienceId });
  dispatch({ type: "SET_PLACEMENTS", placements: s.placements });
  dispatch({ type: "SET_AUTO_PAUSE_GUARDRAIL", enabled: s.autoPauseGuardrailEnabled });
  dispatch({ type: "SET_AUTO_RELAUNCH_ENABLED", enabled: s.autoRelaunchEnabled });
  if (s.abTestEnabled) {
    dispatch({ type: "SET_AB_TEST_ENABLED", enabled: true });
    if (s.abTestAxis) dispatch({ type: "SET_AB_TEST_AXIS", axis: s.abTestAxis });
    if (s.abTestVariantB) dispatch({ type: "SET_AB_TEST_VARIANT_B", value: s.abTestVariantB });
  }
  dispatch({ type: "SET_LANDING_URL", value: s.landingUrl });
  dispatch({ type: "SET_FREQUENCY_CAP", value: s.frequencyCap });
  dispatch({ type: "SET_CALL_SCHEDULE", value: s.callSchedule });
  dispatch({ type: "SET_BUDGET", value: s.budget });
  dispatch({ type: "SET_DATE_START", value: s.dateStart });
  dispatch({ type: "SET_DATE_END", value: s.dateEnd });
  dispatch({ type: "SET_AGE_RANGE", min: s.ageMin, max: s.ageMax });
  dispatch({ type: "SET_GENDER", value: s.gender });
  dispatch({ type: "SET_COUNTRIES", value: s.countries });
  dispatch({ type: "SET_PERSONA_LOCATION", value: s.personaLocation });
  dispatch({ type: "SET_DELIVERY", value: s.delivery });
  dispatch({ type: "SET_IMAGE_DATA_URL", value: s.imageDataUrl });
  dispatch({ type: "SET_FINAL_IMAGE_DATA_URL", value: s.finalImageDataUrl });
  // launchedCampaign 은 복원하지 않음 — 게재 완료 시점에 초안 자체가 삭제된다.
}
