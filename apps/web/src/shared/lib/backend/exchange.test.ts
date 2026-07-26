import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeForBackendToken } from "./exchange";

const ORIGINAL_URL = process.env.ADFLOW_BACKEND_URL;
const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

function realUser() {
  return {
    ownerKey: "owner@example.com",
    email: "owner@example.com",
    role: "팀장" as const,
    metaConnection: { accessToken: "EAAG-token" },
  };
}

describe("exchangeForBackendToken", () => {
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

  it("게스트면 백엔드를 호출하지 않아요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await exchangeForBackendToken({
      ...realUser(),
      ownerKey: "guest@adflow.local",
      email: "guest@adflow.local",
    });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("백엔드 URL 이 없으면 호출하지 않아요", async () => {
    delete process.env.ADFLOW_BACKEND_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await exchangeForBackendToken(realUser());
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("정상이면 토큰을 돌려주고 내부 시크릿을 헤더에 실어요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "jwt-abc", expiresAt: "2026-07-26T12:00:00Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await exchangeForBackendToken(realUser());

    expect(result).toEqual({ token: "jwt-abc", expiresAt: "2026-07-26T12:00:00Z" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/auth/exchange");
    expect((init?.headers as Record<string, string>)["X-Internal-Secret"]).toBe(
      "test-internal-secret",
    );
  });

  it("백엔드가 실패해도 예외를 던지지 않고 null 을 줘요", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const result = await exchangeForBackendToken(realUser());
    expect(result).toBeNull();
  });
});
