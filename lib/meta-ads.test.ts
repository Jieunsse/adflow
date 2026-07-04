import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metaAds, mapSplitTestError, type CreateCampaignParams, type CampaignSummary } from "./meta-ads";
import { MetaApiError } from "./meta-ads-graph";
import { AuthError } from "./route-handler";

// 회귀 안전망 — metaAds.createCampaign 의 internal seam (deriveLaunchPlan + 4 body builder) 을
// 외부 인터페이스 + global.fetch stub 으로 검증. internal 함수는 export 하지 않음 (skill 정렬).
// 검증 surface = fetch 에 보내진 4 (혹은 5) POST body 의 shape.

const fetchMock = vi.fn();

const DEFAULT_IDS = {
  campaignId: "camp_1",
  adsetId: "adset_1",
  creativeId: "creative_1",
  adId: "ad_1",
  imageHash: "img_hash_1",
};

function jsonResponse(body: object, ok = true) {
  return { ok, json: async () => body };
}

// URL 의 마지막 path segment 로 분기 (e.g. ".../act_1/adsets" → "adsets").
function pathSegment(url: string): string {
  return /\/([^/?]+)(?:\?|$)/.exec(url)?.[1] ?? "";
}

interface MockOpts extends Partial<typeof DEFAULT_IDS> {
  failAt?: "campaigns" | "adsets" | "adcreatives" | "ads";
  // 같은 segment 에 N 회 POST 할 때 (A/B 광고 생성) 호출별로 다른 ID 반환.
  failOnNthCall?: { segment: "adcreatives" | "ads"; n: number };
}

function mockMetaApi(opts: MockOpts = {}) {
  const ids = { ...DEFAULT_IDS, ...opts };
  const counters: Record<string, number> = {};
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    // 실패 cleanup 용 DELETE 는 무조건 성공으로 응답.
    if (method === "DELETE") return jsonResponse({ success: true });

    const seg = pathSegment(url);
    counters[seg] = (counters[seg] ?? 0) + 1;
    if (opts.failAt === seg) {
      return jsonResponse({ error: { message: "Mocked failure", code: 100 } });
    }
    if (opts.failOnNthCall && opts.failOnNthCall.segment === seg && opts.failOnNthCall.n === counters[seg]) {
      return jsonResponse({ error: { message: "Mocked Nth failure", code: 100 } });
    }
    switch (seg) {
      case "adimages":
        return jsonResponse({ images: { f: { hash: ids.imageHash, url: "https://example.com/img" } } });
      case "campaigns":
        return jsonResponse({ id: ids.campaignId });
      case "adsets":
        return jsonResponse({ id: ids.adsetId });
      case "adcreatives":
        return jsonResponse({ id: `${ids.creativeId}_${counters[seg]}` });
      case "ads":
        return jsonResponse({ id: `${ids.adId}_${counters[seg]}` });
      default:
        throw new Error(`Unexpected fetch URL segment: ${seg} (url: ${url})`);
    }
  });
}

function findCallBody(segment: string): Record<string, unknown> | null {
  for (const call of fetchMock.mock.calls) {
    if (pathSegment(call[0] as string) === segment) {
      return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
    }
  }
  return null;
}

function findAllCallBodies(segment: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const call of fetchMock.mock.calls) {
    if (pathSegment(call[0] as string) === segment) {
      out.push(JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>);
    }
  }
  return out;
}

const baseParams: CreateCampaignParams = {
  headline: "Test Headline",
  primaryText: "Body text",
  dailyBudget: 50000,
  startDate: "2026-05-16",
  endDate: "2026-05-23",
  ageMin: 22,
  ageMax: 39,
  genders: [],
  countries: ["KR"],
  linkUrl: "https://example.com",
  ctaType: "LEARN_MORE",
  status: "PAUSED",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("metaAds.createCampaign — plan derivation (optimization_goal)", () => {
  it("simple + traffic → LANDING_PAGE_VIEWS", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "simple", objective: "OUTCOME_TRAFFIC" }, "tok", "act_1", "page_1");
    const adset = findCallBody("adsets")!;
    expect(adset.optimization_goal).toBe("LANDING_PAGE_VIEWS");
  });

  it("simple + awareness → REACH", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "simple", objective: "OUTCOME_AWARENESS" }, "tok", "act_1", "page_1");
    expect(findCallBody("adsets")!.optimization_goal).toBe("REACH");
  });

  it("detailed + traffic → LINK_CLICKS", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "detailed", objective: "OUTCOME_TRAFFIC" }, "tok", "act_1", "page_1");
    expect(findCallBody("adsets")!.optimization_goal).toBe("LINK_CLICKS");
  });

  it("detailed + engagement → POST_ENGAGEMENT", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "detailed", objective: "OUTCOME_ENGAGEMENT" }, "tok", "act_1", "page_1");
    expect(findCallBody("adsets")!.optimization_goal).toBe("POST_ENGAGEMENT");
  });

  it("missing objective → defaults to OUTCOME_TRAFFIC", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "simple" }, "tok", "act_1", "page_1");
    const campaign = findCallBody("campaigns")!;
    expect(campaign.objective).toBe("OUTCOME_TRAFFIC");
  });

  it("OUTCOME_TRAFFIC → adset includes destination_type: WEBSITE", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, objective: "OUTCOME_TRAFFIC" }, "tok", "act_1", "page_1");
    expect(findCallBody("adsets")!.destination_type).toBe("WEBSITE");
  });

  it("OUTCOME_AWARENESS → adset has NO destination_type", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, objective: "OUTCOME_AWARENESS" }, "tok", "act_1", "page_1");
    expect(findCallBody("adsets")).not.toHaveProperty("destination_type");
  });
});

// PRD §13 — 신규 4 goal 의 payload 회귀. dev mode probe 통과한 시나리오 그대로 빌더가 생성하는지.
describe("metaAds.createCampaign — Phase 1 goal 분기", () => {
  it("goalId='traffic_page_visit' → LANDING_PAGE_VIEWS · destination WEBSITE · no promoted_object", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, goalId: "traffic_page_visit" }, "tok", "act_1", "page_1");
    const campaign = findCallBody("campaigns")!;
    const adset = findCallBody("adsets")!;
    expect(campaign.objective).toBe("OUTCOME_TRAFFIC");
    expect(adset.optimization_goal).toBe("LANDING_PAGE_VIEWS");
    expect(adset.destination_type).toBe("WEBSITE");
    expect(adset).not.toHaveProperty("promoted_object");
  });

  it("goalId='engagement_page_likes' → PAGE_LIKES · ON_PAGE · promoted_object.page_id", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, goalId: "engagement_page_likes" }, "tok", "act_1", "page_1");
    const campaign = findCallBody("campaigns")!;
    const adset = findCallBody("adsets")!;
    expect(campaign.objective).toBe("OUTCOME_ENGAGEMENT");
    expect(adset.optimization_goal).toBe("PAGE_LIKES");
    expect(adset.destination_type).toBe("ON_PAGE");
    expect(adset.promoted_object).toEqual({ page_id: "page_1" });
  });

  it("goalId='engagement_messages' → CONVERSATIONS · MESSENGER · promoted_object.page_id", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, goalId: "engagement_messages" }, "tok", "act_1", "page_1");
    const adset = findCallBody("adsets")!;
    expect(adset.optimization_goal).toBe("CONVERSATIONS");
    expect(adset.destination_type).toBe("MESSENGER");
    expect(adset.promoted_object).toEqual({ page_id: "page_1" });
  });

  it("goalId='leads_call' → OUTCOME_LEADS · QUALITY_CALL · PHONE_CALL · promoted_object.page_id", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, goalId: "leads_call" }, "tok", "act_1", "page_1");
    const campaign = findCallBody("campaigns")!;
    const adset = findCallBody("adsets")!;
    expect(campaign.objective).toBe("OUTCOME_LEADS");
    expect(adset.optimization_goal).toBe("QUALITY_CALL");
    expect(adset.destination_type).toBe("PHONE_CALL");
    expect(adset.promoted_object).toEqual({ page_id: "page_1" });
  });

  it("goalId 가 우선 — objective 가 다른 값이어도 goalId 의 Meta config 가 적용", async () => {
    mockMetaApi();
    await metaAds.createCampaign(
      { ...baseParams, goalId: "leads_call", objective: "OUTCOME_TRAFFIC" },
      "tok", "act_1", "page_1",
    );
    const campaign = findCallBody("campaigns")!;
    const adset = findCallBody("adsets")!;
    expect(campaign.objective).toBe("OUTCOME_LEADS");
    expect(adset.optimization_goal).toBe("QUALITY_CALL");
  });

  it("MESSAGE_PAGE CTA → creative.call_to_action 에 app_destination=MESSENGER 포함", async () => {
    mockMetaApi();
    await metaAds.createCampaign(
      { ...baseParams, goalId: "engagement_messages", ctaType: "MESSAGE_PAGE" },
      "tok", "act_1", "page_1",
    );
    const creative = findCallBody("adcreatives")!;
    const linkData = (creative.object_story_spec as Record<string, unknown>).link_data as Record<string, unknown>;
    expect(linkData.call_to_action).toEqual({ type: "MESSAGE_PAGE", value: { app_destination: "MESSENGER" } });
  });
});

describe("metaAds.createCampaign — bid strategy", () => {
  it("default bidStrategy → no bid_amount in adset body", async () => {
    mockMetaApi();
    await metaAds.createCampaign(baseParams, "tok", "act_1", "page_1");
    const adset = findCallBody("adsets")!;
    expect(adset.bid_strategy).toBe("LOWEST_COST_WITHOUT_CAP");
    expect(adset).not.toHaveProperty("bid_amount");
  });

  it("bid cap + bidAmount → propagates to bid_amount (string)", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, bidStrategy: "LOWEST_COST_WITH_BID_CAP", bidAmount: 1500 }, "tok", "act_1", "page_1");
    const adset = findCallBody("adsets")!;
    expect(adset.bid_strategy).toBe("LOWEST_COST_WITH_BID_CAP");
    expect(adset.bid_amount).toBe("1500");
  });

  it("bid cap but bidAmount=undefined → no bid_amount", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, bidStrategy: "COST_CAP" }, "tok", "act_1", "page_1");
    expect(findCallBody("adsets")).not.toHaveProperty("bid_amount");
  });
});

describe("metaAds.createCampaign — placement / platforms", () => {
  it("platforms='both' + auto placement → no publisher_platforms in targeting", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, platforms: "both" }, "tok", "act_1", "page_1");
    const adset = findCallBody("adsets")!;
    const targeting = adset.targeting as Record<string, unknown>;
    expect(targeting).not.toHaveProperty("publisher_platforms");
  });

  it("platforms='facebook' + auto placement → publisher_platforms: ['facebook']", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, platforms: "facebook" }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    expect(targeting.publisher_platforms).toEqual(["facebook"]);
  });

  it("manual placements → publisher_platforms + position keys encoded", async () => {
    mockMetaApi();
    await metaAds.createCampaign(
      { ...baseParams, placements: { mode: "manual", positions: ["facebook_feed", "instagram_stories"] } },
      "tok", "act_1", "page_1",
    );
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    expect(targeting.publisher_platforms).toEqual(expect.arrayContaining(["facebook", "instagram"]));
    expect(targeting.facebook_positions).toEqual(["feed"]);
    expect(targeting.instagram_positions).toEqual(["story"]);
  });
});

describe("metaAds.createCampaign — targeting", () => {
  it("genders=[] → adset.targeting has NO genders key", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, genders: [] }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    expect(targeting).not.toHaveProperty("genders");
  });

  it("genders=[1] → adset.targeting.genders=[1]", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, genders: [1] }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    expect(targeting.genders).toEqual([1]);
  });

  it("simple mode → advantage_audience: 1", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "simple" }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    const automation = targeting.targeting_automation as Record<string, number>;
    expect(automation.advantage_audience).toBe(1);
  });

  it("detailed mode → advantage_audience: 0", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "detailed" }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    const automation = targeting.targeting_automation as Record<string, number>;
    expect(automation.advantage_audience).toBe(0);
  });

  it("simple mode + ageMax<65 → age_max 가 65 로 끌어올려짐 (subcode 1870189 회피)", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "simple", ageMax: 39 }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    expect(targeting.age_max).toBe(65);
  });

  it("detailed mode + ageMax<65 → age_max 가 유저 입력 그대로", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "detailed", ageMax: 39 }, "tok", "act_1", "page_1");
    const targeting = findCallBody("adsets")!.targeting as Record<string, unknown>;
    expect(targeting.age_max).toBe(39);
  });
});

describe("metaAds.createCampaign — creative body shape", () => {
  it("simple mode → creative has degrees_of_freedom_spec (standard_enhancements opt-in)", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "simple" }, "tok", "act_1", "page_1");
    const creative = findCallBody("adcreatives")!;
    expect(creative).toHaveProperty("degrees_of_freedom_spec");
  });

  it("detailed mode → creative has NO degrees_of_freedom_spec", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, mode: "detailed" }, "tok", "act_1", "page_1");
    expect(findCallBody("adcreatives")).not.toHaveProperty("degrees_of_freedom_spec");
  });
});

describe("metaAds.createCampaign — image upload", () => {
  it("with imageDataUrl → /adimages POSTed first, image_hash in creative body", async () => {
    mockMetaApi();
    await metaAds.createCampaign(
      { ...baseParams, imageDataUrl: "data:image/jpeg;base64,/9j/4AAQ" },
      "tok", "act_1", "page_1",
    );
    expect(findCallBody("adimages")).not.toBeNull();
    const creative = findCallBody("adcreatives")!;
    const objectStory = creative.object_story_spec as Record<string, unknown>;
    const linkData = objectStory.link_data as Record<string, unknown>;
    expect(linkData.image_hash).toBe("img_hash_1");
  });

  it("without imageDataUrl → no /adimages call, no image_hash", async () => {
    mockMetaApi();
    await metaAds.createCampaign(baseParams, "tok", "act_1", "page_1");
    expect(findCallBody("adimages")).toBeNull();
    const linkData = (findCallBody("adcreatives")!.object_story_spec as Record<string, unknown>).link_data as Record<string, unknown>;
    expect(linkData).not.toHaveProperty("image_hash");
  });
});

describe("metaAds.createCampaign — skipAdCreation", () => {
  it("skipAdCreation=true → only campaign + adset POSTed, no creative/ad", async () => {
    mockMetaApi();
    const result = await metaAds.createCampaign({ ...baseParams, skipAdCreation: true }, "tok", "act_1", "page_1");
    expect(findCallBody("campaigns")).not.toBeNull();
    expect(findCallBody("adsets")).not.toBeNull();
    expect(findCallBody("adcreatives")).toBeNull();
    expect(findCallBody("ads")).toBeNull();
    expect(result).toEqual({ campaignId: "camp_1", adSetId: "adset_1" });
    expect(result).not.toHaveProperty("adId");
  });
});

// PRD-ab-testing.md §4 — 축 일반화. Phase 1 = headline 축. 같은 Campaign/AdSet + AdCreative ×2 + Ad ×2.
describe("metaAds.createCampaign — A/B headline test", () => {
  it("abTestEnabled + axis=headline + variantB → adcreatives POST 2회, ads POST 2회, image_hash 공유", async () => {
    mockMetaApi();
    const result = await metaAds.createCampaign(
      {
        ...baseParams,
        imageDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
        abTestEnabled: true,
        abTestAxis: "headline",
        abTestVariantB: { axis: "headline", headline: "B안 헤드라인" },
      },
      "tok", "act_1", "page_1",
    );

    // /adimages 는 한 번만 (이미지 hash 공유)
    expect(findAllCallBodies("adimages")).toHaveLength(1);
    // /adcreatives 와 /ads 는 두 번씩
    const creatives = findAllCallBodies("adcreatives");
    const ads = findAllCallBodies("ads");
    expect(creatives).toHaveLength(2);
    expect(ads).toHaveLength(2);

    // 두 Creative 의 image_hash 동일
    const linkDataA = (creatives[0].object_story_spec as Record<string, unknown>).link_data as Record<string, unknown>;
    const linkDataB = (creatives[1].object_story_spec as Record<string, unknown>).link_data as Record<string, unknown>;
    expect(linkDataA.image_hash).toBe("img_hash_1");
    expect(linkDataB.image_hash).toBe("img_hash_1");

    // 헤드라인만 다름 (한 변수만 다름 — A/B 통계 원칙)
    expect(linkDataA.name).toBe("Test Headline");
    expect(linkDataB.name).toBe("B안 헤드라인");
    expect(linkDataA.message).toBe(linkDataB.message);
    expect(linkDataA.link).toBe(linkDataB.link);
    expect(linkDataA.call_to_action).toEqual(linkDataB.call_to_action);

    // Ad/Creative 이름에 A/B prefix
    expect(creatives[0].name).toContain("Creative A");
    expect(creatives[1].name).toContain("Creative B");
    expect(ads[0].name).toContain("Ad A");
    expect(ads[1].name).toContain("Ad B");

    // 응답에 adIds 두 개, 단일 adId 없음
    expect(result.adIds).toEqual(["ad_1_1", "ad_1_2"]);
    expect(result.adId).toBeUndefined();
  });

  it("abTestEnabled 인데 skipAdCreation 이면 — lib 은 skip 경로 (route 가 fake adIds 합성)", async () => {
    mockMetaApi();
    // lib 의 책임은 Meta API 호출. fake adIds 발급은 route 의 책임 (PRD-ab-testing.md §7.5).
    const result = await metaAds.createCampaign(
      { ...baseParams, abTestEnabled: true, abTestAxis: "headline", abTestVariantB: { axis: "headline", headline: "B" }, skipAdCreation: true },
      "tok", "act_1", "page_1",
    );
    expect(findAllCallBodies("adcreatives")).toHaveLength(0);
    expect(findAllCallBodies("ads")).toHaveLength(0);
    expect(result.adIds).toBeUndefined();
  });

  it("두 번째 Ad 생성 실패 → 캠페인 통째 DELETE 롤백", async () => {
    mockMetaApi({ failOnNthCall: { segment: "ads", n: 2 } });
    await expect(
      metaAds.createCampaign(
        { ...baseParams, abTestEnabled: true, abTestAxis: "headline", abTestVariantB: { axis: "headline", headline: "B안" } },
        "tok", "act_1", "page_1",
      ),
    ).rejects.toThrow(/Meta API/);
    const deleteCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toContain("camp_1");
  });

  it("abTestAxis/variantB 누락 → 단일 광고 경로 (A/B 분기 안 탐)", async () => {
    mockMetaApi();
    // 방어적 — 라우트가 ValidationError 던지지만, 만약 enabled=true 인데 axis/variantB 가 빠지면 단일로 처리.
    const result = await metaAds.createCampaign(
      { ...baseParams, abTestEnabled: true },
      "tok", "act_1", "page_1",
    );
    expect(findAllCallBodies("adcreatives")).toHaveLength(1);
    expect(findAllCallBodies("ads")).toHaveLength(1);
    expect(result.adId).toBeDefined();
    expect(result.adIds).toBeUndefined();
  });

  it("Phase 1.5 — axis='primary_text' → AdCreative 2개, primaryText 만 갈리고 headline 공유", async () => {
    mockMetaApi();
    const result = await metaAds.createCampaign(
      { ...baseParams, abTestEnabled: true, abTestAxis: "primary_text", abTestVariantB: { axis: "primary_text", primaryText: "다른 카피" } },
      "tok", "act_1", "page_1",
    );
    const creatives = findAllCallBodies("adcreatives");
    expect(creatives).toHaveLength(2);
    const linkA = (creatives[0].object_story_spec as { link_data: { name: string; message: string } }).link_data;
    const linkB = (creatives[1].object_story_spec as { link_data: { name: string; message: string } }).link_data;
    expect(linkA.name).toBe("Test Headline");
    expect(linkB.name).toBe("Test Headline");
    expect(linkA.message).toBe("Body text");
    expect(linkB.message).toBe("다른 카피");
    expect(result.adIds).toHaveLength(2);
  });
});

describe("metaAds.createCampaign — validation", () => {
  it("empty pageId → throws", async () => {
    mockMetaApi();
    await expect(metaAds.createCampaign(baseParams, "tok", "act_1", "")).rejects.toThrow(/페이지/);
  });

  it("empty countries → throws", async () => {
    mockMetaApi();
    await expect(metaAds.createCampaign({ ...baseParams, countries: [] }, "tok", "act_1", "page_1")).rejects.toThrow(/지역|국가/);
  });
});

describe("metaAds.createCampaign — cleanup on failure", () => {
  it("adsets POST fails → campaign DELETE called, error rethrown", async () => {
    mockMetaApi({ failAt: "adsets" });
    await expect(metaAds.createCampaign(baseParams, "tok", "act_1", "page_1")).rejects.toThrow(/Meta API/);
    // DELETE call 이 fetchMock 호출에 있는지 검증.
    const deleteCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    // 삭제 대상 URL 에 campaignId 가 포함돼야 함.
    expect(deleteCall![0]).toContain("camp_1");
  });
});

describe("metaAds.createCampaign — status propagation", () => {
  it("status='PAUSED' → propagates to all 4 POSTs", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, status: "PAUSED" }, "tok", "act_1", "page_1");
    expect(findCallBody("campaigns")!.status).toBe("PAUSED");
    expect(findCallBody("adsets")!.status).toBe("PAUSED");
    expect(findCallBody("ads")!.status).toBe("PAUSED");
  });

  it("status='ACTIVE' → propagates", async () => {
    mockMetaApi();
    await metaAds.createCampaign({ ...baseParams, status: "ACTIVE" }, "tok", "act_1", "page_1");
    expect(findCallBody("campaigns")!.status).toBe("ACTIVE");
    expect(findCallBody("adsets")!.status).toBe("ACTIVE");
    expect(findCallBody("ads")!.status).toBe("ACTIVE");
  });
});

// PRD-billing §11.2 — getBilling 매퍼 + 에러 처리. fetch stub 으로 Meta 응답 형태별 검증.
describe("metaAds.getBilling — 매퍼", () => {
  function stubBilling(body: object) {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => body }));
  }

  const fullBody = {
    name: "Test Account",
    account_status: 1,
    currency: "KRW",
    balance: "12345",
    spend_cap: "100000",
    amount_spent: "55000",
    business_name: "AdFlow Co",
    business_street: "역삼로 1",
    business_city: "서울",
    business_state: "Seoul",
    business_zip: "06236",
    business_country_code: "KR",
    funding_source_details: [
      { id: "fs_1", display_string: "Visa **** 1234", type: "CREDIT_CARD" },
    ],
  };

  it("정상 풀 필드 → Billing 매핑 정확", async () => {
    stubBilling(fullBody);
    const result = await metaAds.getBilling("tok", "act_1");
    expect(result.accountId).toBe("act_1");
    expect(result.accountName).toBe("Test Account");
    expect(result.currency).toBe("KRW");
    expect(result.accountStatus).toBe(1);
    expect(result.balance).toBe(12345);
    expect(result.spendCap).toBe(100000);
    expect(result.amountSpent).toBe(55000);
    expect(result.business.name).toBe("AdFlow Co");
    expect(result.business.countryCode).toBe("KR");
    expect(result.fundingSources).toEqual([
      { id: "fs_1", displayString: "Visa **** 1234", type: "CREDIT_CARD" },
    ]);
  });

  it("spend_cap / amount_spent 누락 → null 보존", async () => {
    stubBilling({ ...fullBody, spend_cap: null, amount_spent: undefined });
    const result = await metaAds.getBilling("tok", "act_1");
    expect(result.spendCap).toBeNull();
    expect(result.amountSpent).toBeNull();
  });

  it("funding_source_details 누락 → fundingSources=[]", async () => {
    const { funding_source_details: _drop, ...rest } = fullBody;
    void _drop;
    stubBilling(rest);
    const result = await metaAds.getBilling("tok", "act_1");
    expect(result.fundingSources).toEqual([]);
  });

  it("funding_source_details { data: [...] } 래핑 형태 → 정상 추출", async () => {
    stubBilling({
      ...fullBody,
      funding_source_details: {
        data: [{ id: "fs_2", display_string: "Master **** 5678", type: "CREDIT_CARD" }],
      },
    });
    const result = await metaAds.getBilling("tok", "act_1");
    expect(result.fundingSources).toHaveLength(1);
    expect(result.fundingSources[0].displayString).toBe("Master **** 5678");
  });

  it("account_status 비활성 코드들 → 그대로 통과", async () => {
    for (const code of [2, 3, 7, 9, 100, 101]) {
      stubBilling({ ...fullBody, account_status: code });
      const result = await metaAds.getBilling("tok", "act_1");
      expect(result.accountStatus).toBe(code);
    }
  });

  it("business_* 일부 누락 → BusinessInfo 의 해당 필드만 null", async () => {
    stubBilling({
      ...fullBody,
      business_city: null,
      business_zip: undefined,
    });
    const result = await metaAds.getBilling("tok", "act_1");
    expect(result.business.street).toBe("역삼로 1");
    expect(result.business.city).toBeNull();
    expect(result.business.zip).toBeNull();
  });

  it("code 190 (토큰 만료) → AuthError throw", async () => {
    stubBilling({ error: { code: 190, message: "expired" } });
    await expect(metaAds.getBilling("tok", "act_1")).rejects.toThrow(/Meta 인증/);
  });

  it("일반 Meta 에러 → Error throw with 메시지", async () => {
    stubBilling({ error: { code: 100, message: "Invalid parameter" } });
    await expect(metaAds.getBilling("tok", "act_1")).rejects.toThrow(/Meta API/);
  });
});

// /approvals 페이지가 의존하는 사유 매핑 — Meta Graph 의 issues_info 응답 형태별 검증.
describe("metaAds.listCampaigns — issues_info 매핑", () => {
  function stubListCampaigns(data: object[]) {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ data }) }));
  }

  const baseRaw = {
    id: "camp_1",
    name: "AdFlow — 봄세일",
    effective_status: "DISAPPROVED",
    objective: "OUTCOME_TRAFFIC",
    start_time: "2026-05-10T00:00:00+0900",
  };

  async function listOne(extra: object): Promise<CampaignSummary> {
    stubListCampaigns([{ ...baseRaw, ...extra }]);
    const result = await metaAds.listCampaigns("tok", "act_1");
    return result[0];
  }

  it("issues_info 있으면 첫 항목의 summary+message 가 issueReason 으로 매핑", async () => {
    const c = await listOne({
      issues_info: [
        { level: "AD", error_code: 1815869, error_summary: "이미지 텍스트 비율 초과", error_message: "광고 이미지에서 텍스트가 차지하는 비율이 너무 높아 게재가 거부됐어요." },
      ],
    });
    expect(c.issueReason).toEqual({
      summary: "이미지 텍스트 비율 초과",
      message: "광고 이미지에서 텍스트가 차지하는 비율이 너무 높아 게재가 거부됐어요.",
    });
  });

  it("issues_info 없음 → issueReason=null", async () => {
    const c = await listOne({ effective_status: "ACTIVE" });
    expect(c.issueReason).toBeNull();
  });

  it("issues_info=[] (빈 배열) → issueReason=null", async () => {
    const c = await listOne({ issues_info: [] });
    expect(c.issueReason).toBeNull();
  });

  it("error_summary 만 있고 error_message 없음 → message 가 summary 로 fallback", async () => {
    const c = await listOne({
      issues_info: [{ error_summary: "정책 위반" }],
    });
    expect(c.issueReason).toEqual({ summary: "정책 위반", message: "정책 위반" });
  });

  it("error_message 만 있고 error_summary 없음 → summary 가 message 로 fallback", async () => {
    const c = await listOne({
      issues_info: [{ error_message: "긴 설명 텍스트" }],
    });
    expect(c.issueReason).toEqual({ summary: "긴 설명 텍스트", message: "긴 설명 텍스트" });
  });

  it("issues_info 항목에 summary/message 둘 다 비어 있음 → null", async () => {
    const c = await listOne({
      issues_info: [{ level: "AD", error_code: 100 }],
    });
    expect(c.issueReason).toBeNull();
  });

  it("issues_info 가 여러 개여도 첫 항목만 사용", async () => {
    const c = await listOne({
      issues_info: [
        { error_summary: "첫째 이슈" },
        { error_summary: "둘째 이슈" },
      ],
    });
    expect(c.issueReason?.summary).toBe("첫째 이슈");
  });
});

// ADR-053 — split test 게재 거절 한국어 매핑. 우선순위 ① 알려진 코드 ② error_user_msg ③ 제네릭.
describe("mapSplitTestError", () => {
  it("알려진 subcode(1487390, 예산 미달) → 우리 한국어", () => {
    const out = mapSplitTestError(new MetaApiError("raw", 100, 1487390, "Meta 원문"));
    expect(out.message).toContain("예산이 부족");
  });

  it("알 수 없는 코드 + error_user_msg 있으면 그대로 통과", () => {
    const out = mapSplitTestError(new MetaApiError("raw", 100, 99999, "기간이 너무 짧아요"));
    expect(out.message).toBe("기간이 너무 짧아요");
  });

  it("MetaApiError 아니거나 user_msg 없으면 제네릭 폴백", () => {
    expect(mapSplitTestError(new Error("그냥 에러")).message).toContain("Meta 가 A/B 게재를 거절");
    expect(mapSplitTestError(new MetaApiError("raw", 100, undefined)).message).toContain("Meta 가 A/B 게재를 거절");
  });

  it("AuthError(인증 만료)는 매핑하지 않고 그대로 통과", () => {
    const auth = new AuthError("로그인 다시");
    expect(mapSplitTestError(auth)).toBe(auth);
  });
});
