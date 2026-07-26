import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerRunner } from "./server-runner";
import type { TournamentStore } from "./adapters";
import type { Tournament, TournamentDelivery, TourVariant } from "./engine";

vi.mock("@/lib/gemini-creative", () => ({
  geminiCreative: {
    generate: vi.fn().mockResolvedValue({
      headlines: ["AI 헤드라인1", "AI 헤드라인2", "AI 헤드라인3"],
      primaryTexts: ["AI 본문1", "AI 본문2", "AI 본문3"],
      targeting: { ageMin: 20, ageMax: 45, genders: [] },
      hooks: ["benefit", "trust", "now"],
    }),
  },
}));

const delivery: TournamentDelivery = {
  accessToken: "tok", adAccountId: "act_1", pageId: "page_1", ownerEmail: "u@x.com",
  goalId: "traffic", linkUrl: "https://x.com", ctaType: "LEARN_MORE",
  countries: ["KR"], ageMin: 20, ageMax: 45, roundDays: 7,
};

// in-memory store
function memStore(): TournamentStore & { _all: Map<string, Tournament> } {
  const all = new Map<string, Tournament>();
  return {
    _all: all,
    async list() { return [...all.values()]; },
    async listByOwner(key) { return [...all.values()].filter((t) => t.delivery?.ownerEmail === key); },
    async listByBrandOwner(brandProfileId, key) {
      return [...all.values()].filter((t) => t.brandProfileId === brandProfileId && t.delivery?.ownerEmail === key);
    },
    async get(id) { return all.get(id) ?? null; },
    async upsert(t) { all.set(t.id, structuredClone(t)); },
    async remove(id) { all.delete(id); },
  };
}

const champion: TourVariant = { headline: "기존 헤드라인", primaryText: "기존 본문" };

function baseSetup(over = {}) {
  return {
    brandProfileId: "b1", productId: "p1", productName: "세럼",
    tone: "warm", objective: "traffic", mode: "auto" as const,
    envelope: { totalBudget: 1_000_000 }, dailyBudget: 30000, startingCtr: 1.5,
    championSource: "existing" as const, startingChampion: champion,
    championSourceName: "기존 캠페인", delivery, ...over,
  };
}

describe("createServerRunner", () => {
  let store: ReturnType<typeof memStore>;
  let nowMs: number;

  beforeEach(() => {
    vi.clearAllMocks();
    store = memStore();
    nowMs = Date.parse("2026-05-31T00:00:00Z");
  });

  function runner() {
    return createServerRunner({ store, now: () => nowMs });
  }

  it("existing 챔피언은 즉시 확정되어 저장된다 (Gemini 미호출)", async () => {
    const id = await runner().createTournament(baseSetup());
    const t = await store.get(id);
    expect(t?.championConfirmed).toBe(true);
    expect(t?.champion).toEqual(champion);
    expect(t?.delivery?.accessToken).toBe("tok");
  });

  it("ai 챔피언은 Gemini 로 생성하고 자동 확정된다 (ADR-054)", async () => {
    const id = await runner().createTournament(
      baseSetup({ championSource: "ai", startingChampion: undefined, championSourceName: undefined }),
    );
    const t = await store.get(id);
    expect(t?.championConfirmed).toBe(true);
    expect(t?.champion.headline).toBe("AI 헤드라인1");
  });

  it("resume 은 lastError 를 지우고 저장한다 (ADR-053 복구)", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());
    const gated = await store.get(id);
    await store.upsert({ ...gated!, lastError: "게재 실패: 테스트" });

    await r.resume(id);
    const t = await store.get(id);
    expect(t?.lastError).toBeUndefined();
  });

});
