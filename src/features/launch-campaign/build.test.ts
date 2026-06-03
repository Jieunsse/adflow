import { describe, expect, it } from "vitest";
import type { CreativeState } from "@entities/creative/model";
import type { LaunchState, LaunchParams, LaunchResponse } from "@entities/campaign/model";
import { buildLaunchParams, buildLaunchedCampaign, launchSuccessMessage, planBrowseLaunch } from "./build";

// 회귀 안전망 — Launch Campaign 빌더의 모드·목표·skip 분기와 페이로드 매핑 일관성.

const baseCreative: CreativeState = {
  tone: "pro",
  headline: "테스트 헤드라인",
  subtitle: "",
  cta: "learn",
  image: "img2",
  primaryText: "본문 카피",
  generatedImages: null,
  targeting: null,
  targetingSource: null,
  outcome: "traffic",
  outcomeHint: "",
  objective: "OUTCOME_TRAFFIC",
  headlineCandidates: null,
  primaryTextCandidates: null,
  subtitleCandidates: null,
  previousOutcome: null,
  overlayHeadlines: null,
};

const baseLaunch: LaunchState = {
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
  landingUrl: "https://example.com/landing",
  budget: "50,000",
  dateStart: "2026-05-16",
  dateEnd: "2026-05-23",
  ageMin: 22,
  ageMax: 39,
  gender: "all",
  countries: ["KR"],
  personaLocation: [],
  delivery: "PAUSED",
  imageDataUrl: null,
  finalImageDataUrl: null,
  launchedCampaign: null,
};

describe("buildLaunchParams", () => {
  it("simple mode → bidStrategy/bidAmount/placements undefined (서버가 기본값 채움)", () => {
    const params = buildLaunchParams(baseCreative, baseLaunch, { skipAdCreation: false });
    expect(params.mode).toBe("simple");
    expect(params.bidStrategy).toBeUndefined();
    expect(params.bidAmount).toBeUndefined();
    expect(params.placements).toBeUndefined();
  });

  it("detailed mode + bid cap → bidStrategy + bidAmount 페이로드 포함", () => {
    const detailedLaunch: LaunchState = {
      ...baseLaunch,
      mode: "detailed",
      bidStrategy: "LOWEST_COST_WITH_BID_CAP",
      bidAmount: 1500,
      placements: { mode: "manual", positions: ["facebook_feed", "instagram_feed"] },
    };
    const params = buildLaunchParams(baseCreative, detailedLaunch, { skipAdCreation: false });
    expect(params.mode).toBe("detailed");
    expect(params.bidStrategy).toBe("LOWEST_COST_WITH_BID_CAP");
    expect(params.bidAmount).toBe(1500);
    expect(params.placements).toEqual({ mode: "manual", positions: ["facebook_feed", "instagram_feed"] });
  });

  it("creative.objective null → OUTCOME_TRAFFIC 으로 폴백", () => {
    const params = buildLaunchParams({ ...baseCreative, objective: null }, baseLaunch, { skipAdCreation: false });
    expect(params.objective).toBe("OUTCOME_TRAFFIC");
  });

  it("budget 문자열 → 정수 파싱 ('50,000' → 50000)", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, budget: "50,000" }, { skipAdCreation: false });
    expect(params.dailyBudget).toBe(50000);
  });

  it("budget 비숫자 문자 무시 ('₩ 100,000원' → 100000)", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, budget: "₩ 100,000원" }, { skipAdCreation: false });
    expect(params.dailyBudget).toBe(100000);
  });

  it("skipAdCreation=true → status 가 강제 PAUSED + skipAdCreation 플래그 전파", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, delivery: "ACTIVE" }, { skipAdCreation: true });
    expect(params.status).toBe("PAUSED");
    expect(params.skipAdCreation).toBe(true);
  });

  it("skipAdCreation=false → delivery 값 그대로 (ACTIVE)", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, delivery: "ACTIVE" }, { skipAdCreation: false });
    expect(params.status).toBe("ACTIVE");
    expect(params.skipAdCreation).toBeUndefined();
  });

  it("landingUrl trim — 앞뒤 공백 제거", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, landingUrl: "  https://example.com  " }, { skipAdCreation: false });
    expect(params.linkUrl).toBe("https://example.com");
  });

  it("gender='all' → genders 빈 배열 (Meta = 전체)", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, gender: "all" }, { skipAdCreation: false });
    expect(params.genders).toEqual([]);
  });

  it("gender='male' → genders [1]", () => {
    const params = buildLaunchParams(baseCreative, { ...baseLaunch, gender: "male" }, { skipAdCreation: false });
    expect(params.genders).toEqual([1]);
  });

  // PRD-ab-testing.md §4 — 축 일반화. Phase 1 = headline 축만 실제 분기.
  describe("abTest 분기", () => {
    const detailedLaunch: LaunchState = {
      ...baseLaunch,
      mode: "detailed",
      abTestEnabled: true,
      abTestAxis: "headline",
      abTestVariantB: { axis: "headline", headline: "B안 헤드라인" },
    };

    it("detailed + B 다름 → axis/variantB 페이로드 실림", () => {
      const params = buildLaunchParams(baseCreative, detailedLaunch, { skipAdCreation: false });
      expect(params.abTestEnabled).toBe(true);
      expect(params.abTestAxis).toBe("headline");
      expect(params.abTestVariantB).toEqual({ axis: "headline", headline: "B안 헤드라인" });
    });

    it("simple + abTestEnabled → fall-through (undefined)", () => {
      // 디테일 → 간단 전환은 reducer 가 cleanup 하지만, 페이로드 빌더도 방어적으로 mode 분기.
      const params = buildLaunchParams(baseCreative, { ...detailedLaunch, mode: "simple" }, { skipAdCreation: false });
      expect(params.abTestEnabled).toBeUndefined();
      expect(params.abTestAxis).toBeUndefined();
      expect(params.abTestVariantB).toBeUndefined();
    });

    // PRD-ab-testing.md §2.1 v0.2 Q4 — 개발모드(skipAdCreation)에서도 A/B 분기 활성. fake adIds 두 개 발급.
    it("skipAdCreation 에서도 A/B 활성 (v0.2 Q4)", () => {
      const params = buildLaunchParams(baseCreative, detailedLaunch, { skipAdCreation: true });
      expect(params.abTestEnabled).toBe(true);
      expect(params.abTestAxis).toBe("headline");
      expect(params.abTestVariantB).toEqual({ axis: "headline", headline: "B안 헤드라인" });
      expect(params.skipAdCreation).toBe(true);
    });

    it("B === A (같은 헤드라인) → fall-through", () => {
      const params = buildLaunchParams(
        baseCreative,
        { ...detailedLaunch, abTestVariantB: { axis: "headline", headline: baseCreative.headline } },
        { skipAdCreation: false },
      );
      expect(params.abTestEnabled).toBeUndefined();
      expect(params.abTestAxis).toBeUndefined();
      expect(params.abTestVariantB).toBeUndefined();
    });

    it("variantB === null (미선택) → fall-through", () => {
      const params = buildLaunchParams(
        baseCreative,
        { ...detailedLaunch, abTestVariantB: null },
        { skipAdCreation: false },
      );
      expect(params.abTestEnabled).toBeUndefined();
      expect(params.abTestAxis).toBeUndefined();
      expect(params.abTestVariantB).toBeUndefined();
    });

    it("abTestEnabled=false 인데 variantB 만 남음 → fall-through", () => {
      const params = buildLaunchParams(
        baseCreative,
        { ...detailedLaunch, abTestEnabled: false },
        { skipAdCreation: false },
      );
      expect(params.abTestEnabled).toBeUndefined();
      expect(params.abTestAxis).toBeUndefined();
      expect(params.abTestVariantB).toBeUndefined();
    });

    it("axis 와 variantB.axis 불일치 → fall-through (invariant)", () => {
      const params = buildLaunchParams(
        baseCreative,
        { ...detailedLaunch, abTestAxis: "primary_text", abTestVariantB: { axis: "headline", headline: "B" } },
        { skipAdCreation: false },
      );
      expect(params.abTestEnabled).toBeUndefined();
    });
  });
});

describe("buildLaunchedCampaign", () => {
  const baseParams: LaunchParams = {
    headline: "h",
    primaryText: "p",
    dailyBudget: 50000,
    startDate: "2026-05-16",
    endDate: "2026-05-23",
    ageMin: 22,
    ageMax: 39,
    genders: [],
    countries: ["KR"],
    linkUrl: "https://example.com",
    cta: "learn",
    status: "PAUSED",
    objective: "OUTCOME_TRAFFIC",
    mode: "simple",
    platforms: "both",
  };
  const baseResponse: LaunchResponse = {
    campaignId: "camp_1",
    adSetId: "adset_1",
    adId: "ad_1",
  };

  it("응답 ID 와 params 핵심 필드 결합", () => {
    const result = buildLaunchedCampaign(baseResponse, baseParams);
    expect(result.campaignId).toBe("camp_1");
    expect(result.adSetId).toBe("adset_1");
    expect(result.adId).toBe("ad_1");
    expect(result.dailyBudget).toBe(50000);
    expect(result.status).toBe("PAUSED");
    expect(result.objective).toBe("OUTCOME_TRAFFIC");
  });

  it("skipAdCreation=true → skipped 플래그 true", () => {
    const result = buildLaunchedCampaign(baseResponse, { ...baseParams, skipAdCreation: true });
    expect(result.skipped).toBe(true);
  });

  it("skipAdCreation undefined → skipped 도 undefined", () => {
    const result = buildLaunchedCampaign(baseResponse, baseParams);
    expect(result.skipped).toBeUndefined();
  });

  it("response.adIds → result.adIds 그대로 전파 (A/B 캠페인 판정용)", () => {
    const result = buildLaunchedCampaign(
      { campaignId: "c", adSetId: "s", adIds: ["a", "b"] },
      { ...baseParams, headline: "A안", abTestEnabled: true, abTestAxis: "headline", abTestVariantB: { axis: "headline", headline: "B안" } },
    );
    expect(result.adIds).toEqual(["a", "b"]);
    expect(result.adId).toBeUndefined();
  });

  // PRD-ab-testing.md §10.1 — adflow:launched:{id} 영속화 + prefill 위한 axis/variantA/variantB 보존.
  it("abTestEnabled → axis/variantA/variantB 보존", () => {
    const result = buildLaunchedCampaign(
      { campaignId: "c", adSetId: "s", adIds: ["a", "b"] },
      { ...baseParams, headline: "A안", abTestEnabled: true, abTestAxis: "headline", abTestVariantB: { axis: "headline", headline: "B안" } },
    );
    expect(result.abTestAxis).toBe("headline");
    expect(result.abTestVariantA).toBe("A안");
    expect(result.abTestVariantB).toEqual({ axis: "headline", headline: "B안" });
  });

  it("abTest off → axis/variantA/variantB 모두 undefined", () => {
    const result = buildLaunchedCampaign(baseResponse, baseParams);
    expect(result.abTestAxis).toBeUndefined();
    expect(result.abTestVariantA).toBeUndefined();
    expect(result.abTestVariantB).toBeUndefined();
  });
});

describe("launchSuccessMessage", () => {
  const baseParams: LaunchParams = {
    headline: "h",
    primaryText: "p",
    dailyBudget: 50000,
    startDate: "2026-05-16",
    endDate: "2026-05-23",
    ageMin: 22,
    ageMax: 39,
    genders: [],
    countries: ["KR"],
    linkUrl: "https://example.com",
    cta: "learn",
    status: "PAUSED",
  };

  it("skipAdCreation → 개발 모드 메시지", () => {
    const msg = launchSuccessMessage({ ...baseParams, skipAdCreation: true });
    expect(msg).toContain("개발 모드");
    expect(msg).toContain("캠페인 + 광고 세트만");
  });

  it("status=ACTIVE → 게재 요청 메시지", () => {
    const msg = launchSuccessMessage({ ...baseParams, status: "ACTIVE" });
    expect(msg).toContain("게재 요청");
  });

  it("status=PAUSED → 일시중지 메시지", () => {
    const msg = launchSuccessMessage({ ...baseParams, status: "PAUSED" });
    expect(msg).toContain("일시중지");
  });

  it("abTestEnabled → 'A/B 시험 — 광고 2개' suffix", () => {
    const msg = launchSuccessMessage({
      ...baseParams,
      status: "ACTIVE",
      abTestEnabled: true,
      abTestAxis: "headline",
      abTestVariantB: { axis: "headline", headline: "B" },
    });
    expect(msg).toContain("A/B 시험");
    expect(msg).toContain("광고 2개");
  });
});

// ADR-033 — Browse Mode 게재 계획. ts 주입으로 결정적 (구 widget runLaunch browse 분기 추출).
describe("planBrowseLaunch", () => {
  const TS = 1717000000000;
  const params = (over: Partial<LaunchState> = {}, creativeOver: Partial<CreativeState> = {}) =>
    buildLaunchParams({ ...baseCreative, ...creativeOver }, { ...baseLaunch, ...over }, { skipAdCreation: false });

  it("결정적 mock ID — campaignId/adSetId/adId 가 ts 기반", () => {
    const plan = planBrowseLaunch(params(), { brandName: "그린루틴", ts: TS });
    expect(plan.launched.campaignId).toBe(`cmp_browse_${TS}`);
    expect(plan.launched.adSetId).toBe(`adset_browse_${TS}`);
    expect(plan.launched.adId).toBe(`ad_browse_${TS}`);
    expect(plan.launched.adIds).toBeUndefined();
    expect(plan.browseCampaign.id).toBe(`cmp_browse_${TS}`);
  });

  it("skipAdCreation → adId 없음 (캠페인+세트만)", () => {
    const p = buildLaunchParams(baseCreative, baseLaunch, { skipAdCreation: true });
    const plan = planBrowseLaunch(p, { ts: TS });
    expect(plan.launched.adId).toBeUndefined();
    expect(plan.launched.adIds).toBeUndefined();
  });

  it("A/B 활성 → adIds 두 개 (_a/_b)", () => {
    const p = buildLaunchParams(baseCreative, {
      ...baseLaunch, mode: "detailed", abTestEnabled: true,
      abTestAxis: "headline", abTestVariantB: { axis: "headline", headline: "B안" },
    }, { skipAdCreation: false });
    const plan = planBrowseLaunch(p, { ts: TS });
    expect(plan.launched.adIds).toEqual([`ad_browse_${TS}_a`, `ad_browse_${TS}_b`]);
    expect(plan.launched.adId).toBeUndefined();
  });

  it("browse 비호환 objective(OUTCOME_SALES) → OUTCOME_TRAFFIC 폴백", () => {
    const plan = planBrowseLaunch(params({}, { objective: "OUTCOME_SALES", outcome: "sales" }), { ts: TS });
    expect(plan.browseCampaign.objective).toBe("OUTCOME_TRAFFIC");
  });

  it("browseCampaign 이름 = brandName + headline, 소재·타겟 보존", () => {
    const plan = planBrowseLaunch(params(), { brandName: "그린루틴", ts: TS });
    expect(plan.browseCampaign.name).toBe("그린루틴 — 테스트 헤드라인");
    expect(plan.browseCampaign.headline).toBe("테스트 헤드라인");
    expect(plan.browseCampaign.countries).toEqual(["KR"]);
  });

  it("brandName 미지정 → '내 캠페인' 폴백", () => {
    const plan = planBrowseLaunch(params(), { ts: TS });
    expect(plan.browseCampaign.name).toBe("내 캠페인 — 테스트 헤드라인");
  });

  it("message = launchSuccessMessage(params) 와 동일", () => {
    const p = params();
    const plan = planBrowseLaunch(p, { ts: TS });
    expect(plan.message).toBe(launchSuccessMessage(p));
  });
});
