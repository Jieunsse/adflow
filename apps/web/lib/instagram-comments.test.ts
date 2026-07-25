import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { listComments } from "./instagram-comments"

const fetchMock = vi.fn()

function jsonResponse(body: object, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const VALID_COMMENT = {
  id: "c1",
  username: "jieunsse_dev",
  text: "테스트 댓글",
  timestamp: "2026-05-25T10:00:00Z",
  like_count: 3,
  hidden: false,
  replies: { summary: { total_count: 2 } },
}

const BASE_OPTS = {
  mediaId: "media_123",
  igAccessToken: "IGAAX_test_token",
}

describe("listComments", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  // ── Behavior 1: 정상 응답 파싱 ──────────────────────────────────────────
  it("정상 응답이면 댓글 목록을 반환한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [VALID_COMMENT] })
    )

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: "c1",
      username: "jieunsse_dev",
      text: "테스트 댓글",
      likeCount: 3,
      hidden: false,
    })
  })

  // ── Behavior 2: replies.summary.total_count → replyCount ───────────────
  it("replies.summary.total_count 를 replyCount 로 매핑한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [VALID_COMMENT] })
    )

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items[0].replyCount).toBe(2)
  })

  it("replies 필드가 없으면 replyCount 는 0 이다", async () => {
    const { replies: _, ...noReplies } = VALID_COMMENT
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [noReplies] })
    )

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items[0].replyCount).toBe(0)
  })

  // ── Behavior 3: HTTP 200 + error body (핵심 버그 후보) ─────────────────
  it("HTTP 200 이지만 error body 이면 ok:false 를 반환한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "Invalid field: hidden", type: "GraphMethodException", code: 100 } },
        true, // ok=true, status=200
        200
      )
    )

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("Invalid field")
  })

  it("OAuthException 이면 토큰 만료 메시지를 반환한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "Token expired", type: "OAuthException", code: 190 } },
        true,
        200
      )
    )

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("만료")
  })

  // ── Behavior 4: HTTP 4xx ────────────────────────────────────────────────
  it("HTTP 4xx 이면 ok:false 를 반환한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "Unsupported operation", type: "GraphMethodException" } },
        false,
        403
      )
    )

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeTruthy()
  })

  // ── Behavior 5: 인증 정보 없음 ──────────────────────────────────────────
  it("igAccessToken 도 pageId 도 없으면 ok:false 를 반환한다", async () => {
    const result = await listComments({ mediaId: "media_123" })

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ── Behavior 6: 여러 댓글 모두 반환 ────────────────────────────────────
  it("data 배열의 모든 댓글을 반환한다", async () => {
    const comments = [
      { ...VALID_COMMENT, id: "c1", text: "첫 번째" },
      { ...VALID_COMMENT, id: "c2", text: "두 번째" },
      { ...VALID_COMMENT, id: "c3", text: "세 번째" },
    ]
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: comments }))

    const result = await listComments(BASE_OPTS)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(3)
    expect(result.items.map((c) => c.id)).toEqual(["c1", "c2", "c3"])
  })

  // ── Behavior 7: 요청 URL에 mediaId와 limit=100 포함 ─────────────────────
  it("API 요청 URL에 mediaId 와 limit=100 이 포함된다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }))

    await listComments(BASE_OPTS)

    const url: string = fetchMock.mock.calls[0][0]
    expect(url).toContain("media_123/comments")
    expect(url).toContain("limit=100")
  })
})
