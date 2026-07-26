import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/lib/notifications/registry", () => ({ pushTournamentConcluded: push }));

import { POST } from "./route";

const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

function req(secret: string | undefined, body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/internal/notify/tournament-concluded", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === undefined ? {} : { "x-internal-secret": secret }),
    },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const base = {
  ownerToken: "TOKEN",
  tournamentId: "t1",
  productName: "수분 크림",
  roundIndex: 2,
  winnerIsB: true,
  completed: false,
  launchedAt: "2026-07-20T00:00:00Z",
};

describe("POST /api/internal/notify/tournament-concluded", () => {
  beforeEach(() => {
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    push.mockReset().mockReturnValue(1);
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("시크릿이 없거나 틀리면 401 이고 아무에게도 안 보내요", async () => {
    expect((await POST(req(undefined, base))).status).toBe(401);
    expect((await POST(req("wrong", base))).status).toBe(401);
    expect(push).not.toHaveBeenCalled();
  });

  it("시크릿이 미설정이면 잠긴 거예요", async () => {
    delete process.env.ADFLOW_INTERNAL_SECRET;
    expect((await POST(req("", base))).status).toBe(401);
  });

  it("결산 문구를 만들어 owner 스트림으로 보내요", async () => {
    await POST(req("test-internal-secret", base));

    const [token, payload] = push.mock.calls[0];
    // registry 키는 액세스 토큰의 해시다 — 토큰 그대로 넘겨야 대상이 맞는다.
    expect(token).toBe("TOKEN");
    expect(payload.message).toBe("라운드 2 결산 완료 — 새 챌린저 승격");
    expect(payload.id).toBe("tourn-t1-r2-2026-07-20T00:00:00Z");
    expect(payload.roundIndex).toBe(2);
  });

  it("챔피언이 방어했으면 문구가 달라져요", async () => {
    await POST(req("test-internal-secret", { ...base, winnerIsB: false }));
    expect(push.mock.calls[0][1].message).toBe("라운드 2 결산 완료 — 챔피언 방어");
  });

  it("완료된 토너먼트는 종료 문구예요", async () => {
    await POST(req("test-internal-secret", { ...base, completed: true }));
    expect(push.mock.calls[0][1].message).toContain("토너먼트가 끝났어요");
  });

  it("연결이 없으면 0 을 돌려주고 끝나요 — 알림은 최선 노력이에요", async () => {
    push.mockReturnValue(0);
    const res = await POST(req("test-internal-secret", base));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ delivered: 0 });
  });
});
