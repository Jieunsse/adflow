import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { roundKpis, roundVerdict } = vi.hoisted(() => ({
  roundKpis: vi.fn(),
  roundVerdict: vi.fn(),
}));
vi.mock("@entities/ab-test/tournament/meta-kpi-source", () => ({
  createMetaKpiSource: () => ({ roundKpis, roundVerdict }),
}));

import { POST } from "./route";

const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

const KPIS = [
  { ctr: 1.8, impressions: 15000, clicks: 270, spend: 91911 },
  { ctr: 2.4, impressions: 15000, clicks: 360, spend: 91911 },
];

function req(secret?: string) {
  return new Request("http://localhost:3000/api/internal/tournament/round-kpis", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === undefined ? {} : { "x-internal-secret": secret }),
    },
    body: JSON.stringify({ tournament: { id: "t1" }, round: { index: 1 } }),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/internal/tournament/round-kpis", () => {
  beforeEach(() => {
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    roundKpis.mockReset().mockResolvedValue(KPIS);
    roundVerdict.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("시크릿이 없으면 401 이고 Meta 를 부르지 않아요", async () => {
    expect((await POST(req())).status).toBe(401);
    expect(roundKpis).not.toHaveBeenCalled();
  });

  it("시크릿이 틀리면 401 이에요", async () => {
    expect((await POST(req("wrong"))).status).toBe(401);
    expect(roundKpis).not.toHaveBeenCalled();
  });

  it("시크릿이 미설정이면 잠긴 거예요 — 빈 헤더로 통과하면 안 돼요", async () => {
    delete process.env.ADFLOW_INTERNAL_SECRET;
    expect((await POST(req(""))).status).toBe(401);
  });

  it("Meta verdict 이 확정이면 kpis 와 함께 돌려줘요", async () => {
    roundVerdict.mockResolvedValue({
      verdict: { state: "winner", ctrA: 1.8, ctrB: 2.4, confidence: 0.97 },
      winner: "B",
    });

    const body = await (await POST(req("test-internal-secret"))).json();
    expect(body.kpis).toEqual(KPIS);
    expect(body.verdict.state).toBe("winner");
    expect(body.winner).toBe("B");
  });

  it("스터디가 진행 중이면 verdict 이 null 이에요 — Spring 이 결산을 보류해요", async () => {
    roundVerdict.mockResolvedValue(null);

    const body = await (await POST(req("test-internal-secret"))).json();
    expect(body.kpis).toEqual(KPIS);
    expect(body.verdict).toBeNull();
    expect(body.winner).toBeNull();
  });
});
