import { afterEach, describe, expect, it } from "vitest"
import { prepareInstagramMedia } from "./instagram-upload"

const originalBackendUrl = process.env.ADFLOW_BACKEND_URL
const originalSecret = process.env.ADFLOW_INTERNAL_SECRET

afterEach(() => {
  if (originalBackendUrl === undefined) delete process.env.ADFLOW_BACKEND_URL
  else process.env.ADFLOW_BACKEND_URL = originalBackendUrl
  if (originalSecret === undefined) delete process.env.ADFLOW_INTERNAL_SECRET
  else process.env.ADFLOW_INTERNAL_SECRET = originalSecret
})

describe("prepareInstagramMedia", () => {
  it("인증된 Next 요청에만 사용할 짧은 signed PUT URL을 만들어요", () => {
    process.env.ADFLOW_BACKEND_URL = "https://api.test"
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret"

    const result = prepareInstagramMedia("image", "image/png", 8)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.uploadUrl).toMatch(/^https:\/\/api\.test\/files\/published-media\/[0-9a-f-]+\.png\?expires=\d+&signature=[0-9a-f]{64}$/)
      expect(result.url).toMatch(/^https:\/\/api\.test\/files\/published-media\/[0-9a-f-]+\.png$/)
    }
  })

  it("지원하지 않는 MIME과 범위를 거절해요", () => {
    expect(prepareInstagramMedia("video", "image/png", 8)).toMatchObject({ ok: false, status: 400 })
    expect(prepareInstagramMedia("image", "image/png", 0)).toMatchObject({ ok: false, status: 400 })
  })
})
