import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHmac } from "node:crypto"
import { NextRequest } from "next/server"
import { POST } from "./route"

const secret = "webhook-secret"

function request(body: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/instagram/webhook", {
    method: "POST",
    headers: {
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    },
    body,
  })
}

beforeEach(() => {
  process.env.META_WEBHOOK_APP_SECRET = secret
  process.env.ADFLOW_BACKEND_URL = "http://backend"
  process.env.ADFLOW_INTERNAL_SECRET = "internal-secret"
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.META_WEBHOOK_APP_SECRET
  delete process.env.ADFLOW_BACKEND_URL
  delete process.env.ADFLOW_INTERNAL_SECRET
})

describe("POST /api/instagram/webhook", () => {
  it("잘못된 JSON은 예외 대신 400으로 처리해요", async () => {
    const response = await POST(request("{"))
    expect(response.status).toBe(400)
  })

  it("메시지를 저장한 뒤 200을 반환해요", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${input}`)
      return new Response(null, { status: input.includes("conversation-id") ? 204 : 200 })
    }))
    const body = JSON.stringify({
      object: "instagram",
      entry: [{
        id: "ig_1",
        messaging: [{
          sender: { id: "person_1" },
          recipient: { id: "ig_1" },
          timestamp: 1780000000000,
          message: { mid: "mid_1", text: "안녕하세요" },
        }],
      }],
    })

    const response = await POST(request(body))

    expect(response.status).toBe(200)
    expect(calls.at(-1)).toContain("POST http://backend/internal/ig-messages")
  })

  it("저장 실패는 Meta 재시도를 위해 503으로 반환해요", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) =>
      new Response(null, { status: input.includes("conversation-id") ? 204 : 500 })))
    const body = JSON.stringify({
      object: "instagram",
      entry: [{
        id: "ig_1",
        messaging: [{
          sender: { id: "person_1" }, recipient: { id: "ig_1" }, timestamp: 1780000000000,
          message: { mid: "mid_1", text: "재시도" },
        }],
      }],
    })

    expect((await POST(request(body))).status).toBe(503)
  })
})
