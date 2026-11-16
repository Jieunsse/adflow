import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/gemini-creative", () => ({ geminiCreative: { generate } }));

import { POST } from "./route";

const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

const body = {
  brand: "브랜드 설명",
  target: "제품 설명",
  tone: "warm",
  outcome: "traffic",
  productName: "수분 크림",
  productDescription: "제품 설명",
  variationIntensity: "bold",
  prohibitedWords: ["최저가"],
};

function req(secret?: string) {
  return new Request("http://localhost:3000/api/internal/creative/challenger", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === undefined ? {} : { "x-internal-secret": secret }),
    },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/internal/creative/challenger", () => {
  beforeEach(() => {
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    generate.mockReset().mockResolvedValue({
      headlines: ["헤드1", "헤드2", "헤드3"],
      primaryTexts: ["본문1", "본문2", "본문3"],
      targeting: { ageMin: 20, ageMax: 45, genders: [] },
    });
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("시크릿이 없거나 틀리면 401 이고 Gemini 를 부르지 않아요", async () => {
    // 유료 호출이라 인증 전에 새면 비용이 샌다.
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("wrong"))).status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("시크릿이 미설정이면 잠긴 거예요", async () => {
    delete process.env.ADFLOW_INTERNAL_SECRET;
    expect((await POST(req(""))).status).toBe(401);
  });

  it("헤드라인·본문 후보만 돌려줘요", async () => {
    const res = await POST(req("test-internal-secret"));
    expect(await res.json()).toEqual({
      headlines: ["헤드1", "헤드2", "헤드3"],
      primaryTexts: ["본문1", "본문2", "본문3"],
    });
  });

  it("금칙어를 생성 단계로 넘겨요 (ADR-054)", async () => {
    await POST(req("test-internal-secret"));
    const params = generate.mock.calls[0][0];
    expect(params.prohibitedWords).toEqual(["최저가"]);
    expect(params.product).toEqual({ name: "수분 크림", description: "제품 설명" });
    expect(params.variationIntensity).toBe("bold");
  });
});
