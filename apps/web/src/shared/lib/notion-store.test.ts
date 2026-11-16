import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteNotionConnection, getNotionConnection, saveNotionConnection } from "./notion-store";

const ORIGINAL_URL = process.env.ADFLOW_BACKEND_URL;
const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

const conn = {
  accessToken: "secret_notion_token",
  botId: "bot_1",
  workspaceName: "내 워크스페이스",
};

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("notion-store", () => {
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

  it("내부 시크릿으로 userKey 를 붙여 조회해요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(conn));

    await expect(getNotionConnection("a@x.com")).resolves.toEqual(conn);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/internal/notion-connections?userKey=a%40x.com");
    expect((init as RequestInit).headers).toMatchObject({ "X-Internal-Secret": "test-internal-secret" });
  });

  it("연결이 없으면(204) null 이에요", async () => {
    // 아직 연결 안 한 사용자와 고장을 구분해야 화면이 잘못된 안내를 안 해요.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(getNotionConnection("a@x.com")).resolves.toBeNull();
  });

  it("백엔드가 없으면 조용히 null 이고 호출하지 않아요", async () => {
    delete process.env.ADFLOW_BACKEND_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(getNotionConnection("a@x.com")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("저장은 POST 로 연결 정보를 보내요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ ok: true }));

    await saveNotionConnection("a@x.com", conn);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("userKey=a%40x.com");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(conn);
  });

  it("연결 끊기는 DELETE 예요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ ok: true }));

    await deleteNotionConnection("a@x.com");
    expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});
