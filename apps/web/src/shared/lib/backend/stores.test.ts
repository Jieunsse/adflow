import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock 은 파일 최상단으로 호이스팅되므로 팩토리가 참조할 값도 vi.hoisted 로 끌어올려야 한다.
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: getTokenMock }));

import { createStoreRoute } from "./stores";

const ORIGINAL_URL = process.env.ADFLOW_BACKEND_URL;
const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

function req(method: string, url = "http://localhost:3000/api/stores/library") {
  return new Request(url, {
    method,
    ...(method === "POST"
      ? { body: JSON.stringify({ item: { id: "a" } }), headers: { "content-type": "application/json" } }
      : {}),
  }) as unknown as Parameters<ReturnType<typeof createStoreRoute>["GET"]>[0];
}

describe("createStoreRoute", () => {
  beforeEach(() => {
    process.env.ADFLOW_BACKEND_URL = "http://localhost:8080";
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    getTokenMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.ADFLOW_BACKEND_URL;
    else process.env.ADFLOW_BACKEND_URL = ORIGINAL_URL;
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("세션이 없으면 401 이고 백엔드를 부르지 않아요", async () => {
    getTokenMock.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("둘러보기 게스트는 백엔드를 부르지 않아요", async () => {
    getTokenMock.mockResolvedValue({ email: "guest@adflow.local", backendToken: "jwt-abc" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("백엔드 URL 이 없으면 503 이에요", async () => {
    delete process.env.ADFLOW_BACKEND_URL;
    getTokenMock.mockResolvedValue({ email: "a@x.com", backendToken: "jwt-abc" });
    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(503);
  });

  it("GET 은 Bearer 토큰을 실어 백엔드로 넘기고 본문을 그대로 돌려줘요", async () => {
    getTokenMock.mockResolvedValue({ email: "a@x.com", backendToken: "jwt-abc" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: "a" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await createStoreRoute("/stores/library").GET(req("GET"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: "a" }] });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/stores/library");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
  });

  it("DELETE 는 id 쿼리를 그대로 넘겨요", async () => {
    getTokenMock.mockResolvedValue({ email: "a@x.com", backendToken: "jwt-abc" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await createStoreRoute("/stores/library").DELETE(
      req("DELETE", "http://localhost:3000/api/stores/library?id=cre_1"),
    );

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/stores/library?id=cre_1");
  });

  it("401 이면 refresh 로 한 번 재발급해 재시도해요", async () => {
    getTokenMock.mockResolvedValue({
      email: "a@x.com",
      backendToken: "expired",
      backendRefreshToken: "refresh-abc",
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "fresh",
            expiresAt: "2026-08-01T00:00:00Z",
            refreshToken: "refresh-next",
            refreshExpiresAt: "2026-09-01T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const res = await createStoreRoute("/stores/library").GET(req("GET"));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[1][0]).toBe("http://localhost:8080/auth/refresh");
    expect(
      (fetchSpy.mock.calls[2][1]?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer fresh");
  });

  it("재발급도 실패하면 401 을 그대로 돌려줘요", async () => {
    getTokenMock.mockResolvedValue({
      email: "a@x.com",
      backendToken: "expired",
      backendRefreshToken: "refresh-abc",
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(401);
  });
});
