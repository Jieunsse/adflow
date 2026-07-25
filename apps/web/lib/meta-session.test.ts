import { describe, expect, it } from "vitest"
import type { Session } from "next-auth"
import { requireMetaSession } from "./meta-session"
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
