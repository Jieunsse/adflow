import { describe, expect, it } from "vitest"
import { canApplyIgToken } from "./ConnectionManager"

describe("Instagram token target guard", () => {
  it("다른 IG 계정은 막고, 빈 target 은 팀장만 허용해요", () => {
    expect(canApplyIgToken("ig-1", "ig-2", true)).toBe(false)
    expect(canApplyIgToken(null, "ig-2", false)).toBe(false)
    expect(canApplyIgToken(null, "ig-2", true)).toBe(true)
    expect(canApplyIgToken("ig-1", "ig-1", false)).toBe(true)
  })
})
