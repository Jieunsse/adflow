import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backendTournamentStore, settleRoundOnBackend } from "./backend-store";
import type { Tournament } from "./engine";

const ORIGINAL_URL = process.env.ADFLOW_BACKEND_URL;
const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const tournament = {
  id: "tourn_1",
  brandProfileId: "bp_1",
  delivery: { ownerEmail: "u@x.com" },
} as unknown as Tournament;

describe("backendTournamentStore", () => {
  beforeEach(() => {
    process.env.ADFLOW_BACKEND_URL = "http://localhost:8080";
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.ADFLOW_BACKEND_URL;
    else process.env.ADFLOW_BACKEND_URL = ORIGINAL_URL;
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("cron 스캔은 running 만 서버에서 좁혀 받아요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ items: [tournament] }));

    await expect(backendTournamentStore.list()).resolves.toHaveLength(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/internal/tournaments?status=running");
    // JWT 가 아니라 내부 시크릿이다 — cron 은 세션이 없다.
    expect((init as RequestInit).headers).toMatchObject({ "X-Internal-Secret": "test-internal-secret" });
  });

  it("Ledger 투영은 소유자와 브랜드로 함께 좁혀요 (ADR-047)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ items: [] }));

    await backendTournamentStore.listByBrandOwner("bp 1", "u@x.com");
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "http://localhost:8080/internal/tournaments?ownerKey=u%40x.com&brandProfileId=bp%201",
    );
  });

  it("없는 id 는 null 이에요 — 고장과 구분해야 폴러가 안 멈춰요", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    await expect(backendTournamentStore.get("nope")).resolves.toBeNull();
  });

  it("조회가 실패하면 던져요", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(backendTournamentStore.get("x")).rejects.toThrow(/500/);
  });

  it("upsert 는 delivery 의 ownerKey 로 소유자를 넘겨요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ ok: true }));

    await backendTournamentStore.upsert(tournament);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/internal/tournaments?ownerKey=u%40x.com");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ item: tournament });
  });

  it("소유자를 모르는 토너먼트는 저장하지 않아요", async () => {
    // ownerKey 없이 저장되면 소유자가 영영 조회할 수 없는 고아 행이 된다.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(backendTournamentStore.upsert({ ...tournament, delivery: undefined })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("백엔드가 설정되지 않으면 던져요 — 조용히 건너뛰면 결산이 유실돼요", async () => {
    delete process.env.ADFLOW_BACKEND_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(backendTournamentStore.list()).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("결산은 Spring 을 POST 로 트리거하고 결과를 그대로 돌려줘요", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok({ status: "settled", winnerIsB: true, badge: "winner", completed: false }));

    await expect(settleRoundOnBackend("tourn_1")).resolves.toMatchObject({
      status: "settled",
      winnerIsB: true,
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/internal/tournaments/tourn_1/settle");
    expect((init as RequestInit).method).toBe("POST");
  });
});
