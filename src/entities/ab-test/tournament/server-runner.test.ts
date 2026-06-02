import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerRunner } from "./server-runner";
import type { TournamentStore, RoundLauncher, KpiSource } from "./adapters";
import type { Tournament, TournamentDelivery, TourVariant } from "./engine";
import { MIN_ROUND_DAYS } from "./engine";

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
  let kpiSource: KpiSource;
  let nowMs: number;

  beforeEach(() => {
    vi.clearAllMocks();
    store = memStore();
    nowMs = Date.parse("2026-05-31T00:00:00Z");
    launcher = { launch: vi.fn().mockResolvedValue({ campaignId: "camp_1", adIds: ["ad_A", "ad_B"] }) };
    kpiSource = { roundKpis: vi.fn() };
  });

  function runner() {
    return createServerRunner({ store, launcher, kpiSource, now: () => nowMs });
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

  it("MIN_ROUND_DAYS 미달이면 insufficient (결산 보류)", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());
    await r.proposeChallenger(id);
    await r.launchRound(id);
    // 3일만 경과 (MIN_ROUND_DAYS=4 미달)
    nowMs += 3 * 86400000;
    vi.mocked(kpiSource.roundKpis).mockResolvedValue([
      { ctr: 1.5, impressions: 10000, clicks: 150, spend: 100000 },
      { ctr: 2.5, impressions: 10000, clicks: 250, spend: 100000 },
    ]);
    const res = await r.pollAndSettle(id);
    expect(res.status).toBe("insufficient");
  });

  it("기간 충족 + 챌린저 유의 우위면 B 승격하고 챔피언 교체", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());
    await r.proposeChallenger(id);
    const round = await r.launchRound(id);
    nowMs += (MIN_ROUND_DAYS + 1) * 86400000;
    // 챌린저(B) CTR·CPLC 우위 + 큰 노출 → z-검정 유의
    vi.mocked(kpiSource.roundKpis).mockResolvedValue([
      { ctr: 1.0, impressions: 50000, clicks: 500, spend: 200000 },
      { ctr: 2.0, impressions: 50000, clicks: 1000, spend: 200000 },
    ]);
    const res = await r.pollAndSettle(id);
    expect(res.status).toBe("settled");
    if (res.status === "settled") {
      expect(res.winnerIsB).toBe(true);
      expect(res.badge).toBe("winner");
    }
    const t = await store.get(id);
    expect(t?.champion).toEqual(round?.challenger);
  });

  it("roundVerdict(Meta verdict) 가 B winner 면 z-검정 무관하게 settle + 챔피언 교체", async () => {
    kpiSource = {
      roundKpis: vi.fn().mockResolvedValue([
        { ctr: 1.5, impressions: 100, clicks: 2, spend: 1000 }, // 노출 적어 z-검정이면 insufficient/무의미
        { ctr: 2.5, impressions: 100, clicks: 3, spend: 1000 },
      ]),
      roundVerdict: vi.fn().mockResolvedValue({
        verdict: { state: "winner", ctrA: 1.5, ctrB: 2.5, confidence: 0.95 },
        winner: "B",
      }),
    };
    const r = runner();
    const id = await r.createTournament(baseSetup());
    await r.proposeChallenger(id);
    const round = await r.launchRound(id);
    nowMs += 1 * 86400000; // 1일 — z-검정이면 MIN_ROUND_DAYS 미달이지만 Meta verdict 우선
    const res = await r.pollAndSettle(id);

    expect(res.status).toBe("settled");
    if (res.status === "settled") expect(res.winnerIsB).toBe(true);
    const t = await store.get(id);
    expect(t?.champion).toEqual(round?.challenger);
  });

  it("roundVerdict 가 null(스터디 진행 중)이면 insufficient", async () => {
    kpiSource = {
      roundKpis: vi.fn().mockResolvedValue([
        { ctr: 1.5, impressions: 50000, clicks: 500, spend: 200000 },
        { ctr: 2.0, impressions: 50000, clicks: 1000, spend: 200000 },
      ]),
      roundVerdict: vi.fn().mockResolvedValue(null),
    };
    const r = runner();
    const id = await r.createTournament(baseSetup());
    await r.proposeChallenger(id);
    await r.launchRound(id);
    nowMs += (MIN_ROUND_DAYS + 5) * 86400000; // 기간은 충분하지만 Meta 미확정
    const res = await r.pollAndSettle(id);
    expect(res.status).toBe("insufficient");
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

  it("proposeChallenger 가 가설을 세우고(proposed), launch 가 라운드로(testing), settle 이 verdict 로 확정한다", async () => {
    const r = runner();
    const id = await r.createTournament(baseSetup());

    await r.proposeChallenger(id);
    expect((await store.get(id))?.pendingHypothesis?.status).toBe("proposed");

    await r.launchRound(id);
    const live = await store.get(id);
    expect(live?.pendingHypothesis).toBeUndefined();
    expect(live?.rounds[0].hypothesis?.status).toBe("testing");

    nowMs += (MIN_ROUND_DAYS + 1) * 86400000;
    vi.mocked(kpiSource.roundKpis).mockResolvedValue([
      { ctr: 1.0, impressions: 50000, clicks: 500, spend: 200000 },
      { ctr: 2.0, impressions: 50000, clicks: 1000, spend: 200000 },
    ]);
    await r.pollAndSettle(id);
    const settled = await store.get(id);
    expect(settled?.rounds[0].hypothesis?.status).toBe("resolved");
    expect(settled?.rounds[0].hypothesis?.verdict).toBe("confirmed"); // B 유의 승 = 입증
  });

  it("이전 토너먼트에서 반증된 레버는 다음 토너먼트의 가설 생성에서 회피된다 (Ledger 투영이 결정에 반영)", async () => {
    // 토너먼트 1 — 챔피언(A) 유의 승 → 라운드 가설 반증(refuted)
    const r = runner();
    const id1 = await r.createTournament(baseSetup());
    await r.proposeChallenger(id1);
    const refutedLever = (await store.get(id1))?.pendingHypothesis?.lever;
    await r.launchRound(id1);
    nowMs += (MIN_ROUND_DAYS + 1) * 86400000;
    vi.mocked(kpiSource.roundKpis).mockResolvedValue([
      { ctr: 2.0, impressions: 50000, clicks: 1000, spend: 200000 }, // A(챔피언) 유의 우위
      { ctr: 1.0, impressions: 50000, clicks: 500, spend: 200000 },
    ]);
    await r.pollAndSettle(id1);
    expect((await store.get(id1))?.rounds[0].hypothesis?.verdict).toBe("refuted");

    // 토너먼트 2 — 같은 브랜드·제품·목표·소유자. 투영된 Ledger 가 반증 레버를 가지치기해야 한다.
    const id2 = await r.createTournament(baseSetup());
    await r.proposeChallenger(id2);
    expect((await store.get(id2))?.pendingHypothesis?.lever).not.toBe(refutedLever);
  });
});
