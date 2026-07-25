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
});
