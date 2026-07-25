import { describe, expect, it, vi, beforeEach } from "vitest";

// node 환경에 sessionStorage 없으므로 Map 기반 스텁 주입(usePersonasStorage.test.ts 패턴).
const store = new Map<string, string>();
let throwOnNextSet = false;
vi.stubGlobal("window", {});
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (throwOnNextSet) { throwOnNextSet = false; throw new DOMException("QuotaExceededError"); }
    store.set(k, v);
  },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
});

import { INITIAL_CREATIVE_STATE, type CreativeState, type CreativeAction } from "./model";
import { INITIAL_LAUNCH_STATE, type LaunchState, type LaunchAction } from "@entities/campaign/model";
import {
  saveDraftToSession,
  loadDraftFromSession,
  clearDraftFromSession,
  parseDraft,
  hydrateCreativeDraft,
  hydrateLaunchDraft,
  DRAFT_STORAGE_KEY,
  type StudioSnapshot,
} from "./draft-persistence";

const STUDIO: StudioSnapshot = {
  displayedHeadlines: ["헤드라인 A", "헤드라인 B"],
  displayedSubtitles: null,
  headlineIdx: 1,
  displayedPrimaryTexts: null,
  displayedHooks: null,
  proofPointsCited: null,
  primaryTextIdx: 0,
  hooks: [],
  generatedForOutcome: "sales",
};

describe("draft-persistence", () => {
  beforeEach(() => {
    store.clear();
    throwOnNextSet = false;
  });

  it("저장한 초안을 그대로 복원한다", () => {
    const creative = { ...INITIAL_CREATIVE_STATE, headline: "축제 시작" };
    const launch = { ...INITIAL_LAUNCH_STATE, budget: "100,000" };
    saveDraftToSession(1, creative, launch, STUDIO);

    const restored = loadDraftFromSession();
    expect(restored?.step).toBe(1);
    expect(restored?.creative.headline).toBe("축제 시작");
    expect(restored?.launch.budget).toBe("100,000");
    expect(restored?.studio.displayedHeadlines).toEqual(["헤드라인 A", "헤드라인 B"]);
    expect(restored?.studio.headlineIdx).toBe(1);
  });

  it("삭제하면 복원값이 없다", () => {
    saveDraftToSession(2, INITIAL_CREATIVE_STATE, INITIAL_LAUNCH_STATE, STUDIO);
    clearDraftFromSession();
    expect(loadDraftFromSession()).toBeNull();
  });

  it("깨진 JSON 은 null 로 처리한다", () => {
    store.set(DRAFT_STORAGE_KEY, "{not-json");
    expect(loadDraftFromSession()).toBeNull();
  });

  it("creative/launch/studio 없는 파편은 무효로 판정한다", () => {
    expect(parseDraft(JSON.stringify({ step: 1 }))).toBeNull();
  });

  it("쿼터 초과 시 이미지 필드를 생략하고 나머지는 저장한다", () => {
    const launch = { ...INITIAL_LAUNCH_STATE, budget: "70,000", imageDataUrl: "data:image/png;base64,AAA" };
    throwOnNextSet = true;
    saveDraftToSession(2, INITIAL_CREATIVE_STATE, launch, STUDIO);

    const restored = loadDraftFromSession();
    expect(restored?.launch.budget).toBe("70,000");
    expect(restored?.launch.imageDataUrl).toBeNull();
  });

  it("hydrate 액션 시퀀스가 핵심 필드를 복원한다", () => {
    const creative: CreativeState = {
      ...INITIAL_CREATIVE_STATE,
      outcome: "sales",
      headline: "복원 헤드라인",
      primaryText: "복원 본문",
      headlineCandidates: ["복원 헤드라인", "후보2", "후보3"],
    };
    const launch: LaunchState = {
      ...INITIAL_LAUNCH_STATE,
      budget: "80,000",
      landingUrl: "https://example.com",
      imageDataUrl: "data:image/png;base64,BBB",
      abTestEnabled: true,
      abTestAxis: "headline",
    };

    const creativeActions: CreativeAction[] = [];
    hydrateCreativeDraft((a) => creativeActions.push(a), creative);
    const launchActions: LaunchAction[] = [];
    hydrateLaunchDraft((a) => launchActions.push(a), launch);

    expect(creativeActions[0]).toEqual({ type: "RESET" });
    expect(creativeActions).toContainEqual({ type: "SET_OUTCOME", outcome: "sales" });
    expect(creativeActions).toContainEqual({ type: "SET_HEADLINE", headline: "복원 헤드라인" });
    // SET_OUTCOME 의 cta 파생을 저장값으로 되돌리도록 SET_CTA 가 SET_OUTCOME 뒤에 온다.
    expect(creativeActions.findIndex((a) => a.type === "SET_CTA")).toBeGreaterThan(
      creativeActions.findIndex((a) => a.type === "SET_OUTCOME"),
    );

    expect(launchActions[0]).toEqual({ type: "RESET" });
    expect(launchActions).toContainEqual({ type: "SET_BUDGET", value: "80,000" });
    expect(launchActions).toContainEqual({ type: "SET_AB_TEST_ENABLED", enabled: true });
    expect(launchActions).toContainEqual({ type: "SET_IMAGE_DATA_URL", value: "data:image/png;base64,BBB" });
    expect(launchActions.some((a) => a.type === "SET_LAUNCHED_CAMPAIGN")).toBe(false);
  });
});
