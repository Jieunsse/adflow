import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./meta-credentials", () => ({
  credentialsCache: {
    get: vi.fn(async () => ({ clientId: "test-id", clientSecret: "test-secret" })),
  },
}));

// NextAuth v4 의 CredentialsProvider 는 사용자가 준 id 를 중첩 options 에 담고
// 최상위 id 는 "credentials" 로 둔다(런타임에 병합됨). 양쪽을 다 본다.
type RawProvider = { id: string; options?: { id?: string } };

async function providerIds(): Promise<string[]> {
  vi.resetModules();
  const { getAuthOptionsForNextAuth } = await import("./auth");
  const options = await getAuthOptionsForNextAuth();
  return (options.providers ?? []).map((p) => {
    const raw = p as RawProvider;
    return raw.options?.id ?? raw.id;
  });
}

async function updateJwt(token: Record<string, unknown>, session: Record<string, unknown>) {
  vi.resetModules();
  const { getAuthOptionsForNextAuth } = await import("./auth");
  const options = await getAuthOptionsForNextAuth();
  return options.callbacks?.jwt?.({ token, trigger: "update", session } as never);
}

describe("getAuthOptionsForNextAuth", () => {
  const original = process.env.ADFLOW_BROWSE_ONLY;

  beforeEach(() => {
    delete process.env.ADFLOW_BROWSE_ONLY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADFLOW_BROWSE_ONLY;
    else process.env.ADFLOW_BROWSE_ONLY = original;
  });

  it("자격증명이 있으면 facebook 과 guest 를 모두 등록해요", async () => {
    const ids = await providerIds();
    expect(ids).toContain("facebook");
    expect(ids).toContain("guest");
  });

  it("ADFLOW_BROWSE_ONLY 가 true 면 facebook 을 등록하지 않아요", async () => {
    process.env.ADFLOW_BROWSE_ONLY = "true";
    const ids = await providerIds();
    expect(ids).not.toContain("facebook");
    expect(ids).toContain("guest");
  });

  it("session update 로 role·browseMode·raw access token 을 바꿀 수 없어요", async () => {
    const token = { sub: "user-1", role: "팀원·검토", browseMode: false, igAccessToken: "server-token" };
    const updated = await updateJwt(token, { role: "팀장", browseMode: true, igAccessToken: "attacker-token" });
    expect(updated).toMatchObject({ role: "팀원·검토", browseMode: false, igAccessToken: "server-token" });
  });

  it("legacy Instagram identity 가 바뀌면 기존 token 을 지워요", async () => {
    const updated = await updateJwt(
      { sub: "user-1", igUserId: "old-ig", igAccessToken: "old-token" },
      { igUserId: "new-ig", igUsername: "new-user" },
    );
    expect(updated).toMatchObject({ igUserId: "new-ig", igUsername: "new-user" });
    expect(updated?.igAccessToken).toBeUndefined();
  });
});
