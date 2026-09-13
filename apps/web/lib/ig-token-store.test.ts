import { afterEach, describe, expect, it } from "vitest"
import { getInstagramRedirectUri, openIgPending, sealIgPending } from "./ig-token-store"

const originalSecret = process.env.NEXTAUTH_SECRET
const originalNextAuthUrl = process.env.NEXTAUTH_URL

afterEach(() => {
  if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = originalSecret
  if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL
  else process.env.NEXTAUTH_URL = originalNextAuthUrl
})

describe("Instagram OAuth cookie payload", () => {
  it("암호화 payload 를 복원하고 변조를 거부해요", () => {
    process.env.NEXTAUTH_SECRET = "test-secret"
    const encoded = sealIgPending({ ownerKey: "user-1", igAccessToken: "token", igUserId: "ig-1", igUsername: "user" })
    expect(encoded).toBeTruthy()
    expect(openIgPending(encoded!)).toMatchObject({ ownerKey: "user-1", igUserId: "ig-1" })
    expect(openIgPending(`${encoded}x`)).toBeNull()
  })

  it("잘못된 NEXTAUTH_URL 은 OAuth redirect 를 만들지 않아요", () => {
    process.env.NEXTAUTH_URL = "not-a-url"
    expect(getInstagramRedirectUri({ nextUrl: { origin: "https://app.example.com" } })).toBeNull()
  })
})
