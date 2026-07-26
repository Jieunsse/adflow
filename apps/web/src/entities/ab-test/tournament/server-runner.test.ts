import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerRunner } from "./server-runner";
import type { TournamentStore, RoundLauncher } from "./adapters";
import type { Tournament, TournamentDelivery, TourVariant } from "./engine";
import { resolveHypothesis } from "./hypothesis";

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
  let launcher: RoundLauncher;
  let nowMs: number;

  beforeEach(() => {
    vi.clearAllMocks();
    store = memStore();
    nowMs = Date.parse("2026-05-31T00:00:00Z");
    launcher = { launch: vi.fn().mockResolvedValue({ campaignId: "camp_1", adIds: ["ad_A", "ad_B"] }) };
  });

  function runner() {
    return createServerRunner({ store, launcher, now: () => nowMs });
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

  it("launchRound 가 launcher 게재 결과(campaignId·adIds·launchedAt)를 라운드에 박는다", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());
    await r.proposeChallenger(id);
    const round = await r.launchRound(id);

    expect(round?.campaignId).toBe("camp_1");
    expect(round?.adIds).toEqual(["ad_A", "ad_B"]);
    expect(round?.launchedAt).toBe("2026-05-31T00:00:00.000Z");
    expect(launcher.launch).toHaveBeenCalledOnce();
  });

  it("autoAdvance 는 챔피언 미확정(championConfirmed=false) 게이트면 게재하지 않는다", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());
    const gated = await store.get(id);
    await store.upsert({ ...gated!, championConfirmed: false }); // 셋업 게이트 통과 전 상태
    await r.autoAdvance(id);
    const t = await store.get(id);
    expect(t?.rounds.length).toBe(0);
    expect(launcher.launch).not.toHaveBeenCalled();
  });

  it("autoAdvance 정상: 챌린저 생성+게재로 라운드 1개 추가", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());
    await r.autoAdvance(id);
    const t = await store.get(id);
    expect(t?.rounds.length).toBe(1);
    expect(t?.rounds[0].status).toBe("running");
    expect(t?.rounds[0].adIds).toEqual(["ad_A", "ad_B"]);
  });

  /* ─── ADR-044/047 가설 생명주기 + Ledger 투영 ─────────────── */

  // resolved 로 넘기는 것은 Spring 결산이다 — 여기는 게재까지가 TS 소관이다.
  it("proposeChallenger 가 가설을 세우고(proposed), launch 가 라운드로 옮긴다(testing)", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());

    await r.proposeChallenger(id);
    expect((await store.get(id))?.pendingHypothesis?.status).toBe("proposed");

    await r.launchRound(id);
    const live = await store.get(id);
    expect(live?.pendingHypothesis).toBeUndefined();
    expect(live?.rounds[0].hypothesis?.status).toBe("testing");
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

  it("이전 토너먼트에서 반증된 레버는 다음 토너먼트의 가설 생성에서 회피된다 (Ledger 투영이 결정에 반영)", async () => {
    // 토너먼트 1 — 챔피언(A) 유의 승 → 라운드 가설 반증(refuted).
    // 결산은 Spring 이 하므로 그 결과를 store 에 직접 심는다(같은 순수 함수로 만든다).
    const r = runner();
    const id1 = await r.createTournament(baseSetup());
    await r.proposeChallenger(id1);
    const refutedLever = (await store.get(id1))?.pendingHypothesis?.lever;
    await r.launchRound(id1);

    const t1 = (await store.get(id1))!;
    const verdict = { state: "winner" as const, ctrA: 2.0, ctrB: 1.0, confidence: 0.97 };
    t1.rounds[0].status = "settled";
    t1.rounds[0].verdict = verdict;
    t1.rounds[0].rawWinner = "A";
    t1.rounds[0].hypothesis = resolveHypothesis(
      t1.rounds[0].hypothesis!,
      verdict,
      "A",
      new Date(nowMs).toISOString(),
    );
    await store.upsert(t1);
    expect((await store.get(id1))?.rounds[0].hypothesis?.verdict).toBe("refuted");

    // 토너먼트 2 — 같은 브랜드·제품·목표·소유자. 투영된 Ledger 가 반증 레버를 가지치기해야 한다.
    const id2 = await r.createTournament(baseSetup());
    await r.proposeChallenger(id2);
    expect((await store.get(id2))?.pendingHypothesis?.lever).not.toBe(refutedLever);
  });
});
