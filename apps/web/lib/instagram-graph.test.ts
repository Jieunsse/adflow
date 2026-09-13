import { describe, expect, it } from "vitest"
import { readGraphBody } from "./instagram-graph"

describe("readGraphBody", () => {
  it("실제 Response의 JSON 오류 본문을 보존한다", async () => {
    const body = { error: { message: "bad token" } }
    await expect(readGraphBody(new Response(JSON.stringify(body), { status: 400 }))).resolves.toEqual(body)
  })

  it("JSON이 아닌 실제 Response 본문도 버리지 않는다", async () => {
    await expect(readGraphBody(new Response("upstream unavailable", { status: 503 })))
      .resolves.toBe("upstream unavailable")
  })
})
