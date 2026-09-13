import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"
import { getWorkspaceSession, requireMetaSession } from "./meta-session"
import { AuthError } from "./route-handler"

// resolveAccessToken/resolveAdAccountId 는 NEXT_PUBLIC_META_APP_MODE !== 'development' 일 때
// session 값을 그대로 반환 → 테스트 환경에서 결정적. resolve 치환 자체는 env.ts 책임.

function session(over: Partial<Session> = {}): Session {
  return { expires: "9999-01-01", accessToken: "tok", ...over }
}

describe("requireMetaSession", () => {
  it("세션이 없으면 AuthError", () => {
    expect(() => requireMetaSession(null)).toThrow(AuthError)
  })

  it("accessToken 이 없으면 AuthError(account)", () => {
    expect(() => requireMetaSession(session({ accessToken: undefined }))).toThrow("광고 계정을 먼저 연결해주세요.")
  })

  it("baseline(accessToken)만 통과하면 ResolvedSession 반환", () => {
    const s = requireMetaSession(session())
    expect(s.accessToken).toBe("tok")
    expect(s.adAccountId).toBe("")
    expect(s.pageId).toBe("")
    expect(s.browseMode).toBe(false)
  })

  it("adAccount 요구 시 adAccountId 없으면 throw", () => {
    expect(() => requireMetaSession(session(), ["adAccount"])).toThrow("광고 계정을 먼저 연결해주세요.")
  })

  it("page 요구 시 pageId 없으면 page 메시지", () => {
    expect(() => requireMetaSession(session({ adAccountId: "act_1" }), ["adAccount", "page"])).toThrow(
      "페이스북 페이지를 먼저 선택해주세요.",
    )
  })

  it("ig 요구 시 igUserId 없으면 ig 메시지", () => {
    expect(() => requireMetaSession(session({ adAccountId: "act_1", pageId: "p1" }), ["adAccount", "page", "ig"])).toThrow(
      "인스타그램 계정이 연결돼 있지 않아요.",
    )
  })

  it("요구 필드가 모두 있으면 검증·passthrough 통과", () => {
    const s = requireMetaSession(
      session({ adAccountId: "act_1", pageId: "p1", igUserId: "ig1", pixelId: "px1", igAccessToken: "igtok" }),
      ["adAccount", "page", "ig"],
    )
    expect(s).toMatchObject({
      accessToken: "tok",
      adAccountId: "act_1",
      pageId: "p1",
      igUserId: "ig1",
      pixelId: "px1",
      igAccessToken: "igtok",
      browseMode: false,
    })
  })

  it("browseMode 플래그 passthrough", () => {
    expect(requireMetaSession(session({ browseMode: true })).browseMode).toBe(true)
  })

})

describe("getWorkspaceSession", () => {
  beforeEach(() => {
    process.env.ADFLOW_BACKEND_URL = "http://backend"
    process.env.ADFLOW_INTERNAL_SECRET = "secret"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.ADFLOW_BACKEND_URL
    delete process.env.ADFLOW_INTERNAL_SECRET
  })

  it("null과 browse 세션은 backend 없이 그대로 통과해요", async () => {
    const browse = session({ browseMode: true, igUserId: "ig_1", igAccessToken: "ig-token" })
    expect(await getWorkspaceSession(null)).toBeNull()
    expect(await getWorkspaceSession(browse)).toBe(browse)
  })

  it("전역 target을 적용하고 다른 IG 계정의 토큰은 버려요", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      target: { adAccountId: "act_shared", pageId: "page_shared", igUserId: "ig_shared" },
    }), { status: 200 })))

    await expect(getWorkspaceSession(session({
      adAccountId: "act_personal", pageId: "page_personal", igUserId: "ig_personal", igAccessToken: "ig-token",
    }))).resolves.toMatchObject({
      adAccountId: "act_shared", pageId: "page_shared", igUserId: "ig_shared", igAccessToken: undefined,
    })
  })

  it("빈 IG target도 명시된 범위 변경으로 보고 토큰을 버려요", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      target: { igUserId: "" },
    }), { status: 200 })))

    await expect(getWorkspaceSession(session({ igUserId: "ig_personal", igAccessToken: "ig-token" })))
      .resolves.toMatchObject({ igUserId: "", igAccessToken: undefined })
  })
})
