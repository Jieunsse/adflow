import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { uploadInstagramFile, validateInstagramUpload } from "./instagram-upload"

const fetchMock = vi.fn()

function file(bytes: number[], type: string) {
  return new File([new Uint8Array(bytes)], "upload", { type })
}

describe("instagram-upload", () => {
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("MIME과 실제 바이트를 검증해요", async () => {
    await expect(validateInstagramUpload(file([0xff, 0xd8, 0xff, 0x00], "image/jpeg"), "image"))
      .resolves.toMatchObject({ ok: true, extension: "jpg" })
    await expect(validateInstagramUpload(file([0x00], "image/png"), "image"))
      .resolves.toEqual({ ok: false, error: "파일 내용이 MIME 형식과 맞지 않아요." })
  })

  it("작은 준비 요청 후 파일은 backend로 직접 PUT해요", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, uploadUrl: "https://api.test/upload", url: "https://api.test/media" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const image = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png")

    await expect(uploadInstagramFile(image, "image", "/api/instagram/upload")).resolves.toBe("https://api.test/media")
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mimeType: "image/png", size: image.size })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PUT", body: image })
  })
})
