import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchReelsPanel, summarizeReels, serializeReelsReportText, toReelsCsv, type IgReel } from "./instagram-reels"

const fetchMock = vi.fn()

function jsonResponse(body: object, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const BASE_CREDS = {
  igUserId: "ig_user_1",
  token: "IGAAX_test_token",
  graphBase: "https://graph.instagram.com",
}

const MEDIA_LIST = [
  {
    id: "reel_1",
    caption: "릴스 캡션 1",
    media_url: "https://example.com/reel1.mp4",
    thumbnail_url: "https://example.com/reel1_thumb.jpg",
    permalink: "https://www.instagram.com/reel/reel_1/",
    timestamp: "2026-06-01T00:00:00Z",
    media_product_type: "REELS",
  },
  {
    id: "post_1",
    caption: "일반 게시물",
    media_url: "https://example.com/post1.jpg",
    timestamp: "2026-06-02T00:00:00Z",
    media_product_type: "IMAGE",
  },
  {
    id: "reel_2",
    caption: "릴스 캡션 2",
    media_url: "https://example.com/reel2.mp4",
    timestamp: "2026-06-03T00:00:00Z",
    media_product_type: "REELS",
  },
]

const INSIGHTS_BODY = {
  data: [
    { name: "plays", values: [{ value: 1000 }] },
    { name: "reach", values: [{ value: 800 }] },
    { name: "likes", values: [{ value: 50 }] },
    { name: "comments", values: [{ value: 5 }] },
    { name: "shares", values: [{ value: 2 }] },
    { name: "saved", values: [{ value: 10 }] },
    { name: "total_interactions", values: [{ value: 67 }] },
  ],
}

describe("fetchReelsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it("media_product_type이 REELS인 항목만 필터링해 반환한다", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/media?")) return Promise.resolve(jsonResponse({ data: MEDIA_LIST }))
      return Promise.resolve(jsonResponse(INSIGHTS_BODY))
    })

    const result = await fetchReelsPanel(BASE_CREDS)

    expect(result.mock).toBe(false)
    expect(result.reels).toHaveLength(2)
    expect(result.reels.map(r => r.id)).toEqual(["reel_1", "reel_2"])
  })

  it("insights 를 매핑하고 coverUrl 은 thumbnail_url 우선, 없으면 media_url 이다", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/media?")) return Promise.resolve(jsonResponse({ data: MEDIA_LIST }))
      return Promise.resolve(jsonResponse(INSIGHTS_BODY))
    })

    const result = await fetchReelsPanel(BASE_CREDS)

    const reel1 = result.reels.find(r => r.id === "reel_1")!
    expect(reel1.coverUrl).toBe("https://example.com/reel1_thumb.jpg")
    expect(reel1.insights).toEqual({
      plays: 1000, reach: 800, likes: 50, comments: 5, shares: 2, saved: 10, totalInteractions: 67,
    })

    const reel2 = result.reels.find(r => r.id === "reel_2")!
    expect(reel2.coverUrl).toBe("https://example.com/reel2.mp4")
  })

  it("특정 릴스의 insights 호출이 실패해도 해당 릴스만 0으로 폴백하고 전체는 실패하지 않는다", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/media?")) return Promise.resolve(jsonResponse({ data: MEDIA_LIST }))
      if (url.includes("reel_1/insights")) return Promise.resolve(jsonResponse({}, false, 500))
      return Promise.resolve(jsonResponse(INSIGHTS_BODY))
    })

    const result = await fetchReelsPanel(BASE_CREDS)

    const reel1 = result.reels.find(r => r.id === "reel_1")!
    expect(reel1.insights).toEqual({
      plays: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, totalInteractions: 0,
    })
    const reel2 = result.reels.find(r => r.id === "reel_2")!
    expect(reel2.insights.plays).toBe(1000)
  })

  it("media 목록 조회 자체가 실패하면 throw 한다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500))

    await expect(fetchReelsPanel(BASE_CREDS)).rejects.toThrow()
  })
})

const SAMPLE_REELS: IgReel[] = [
  {
    id: "r1",
    caption: "첫 번째 릴스",
    coverUrl: "https://example.com/r1.jpg",
    permalink: "https://www.instagram.com/reel/r1/",
    timestamp: "2026-06-01T00:00:00Z",
    insights: { plays: 1000, reach: 800, likes: 50, comments: 5, shares: 2, saved: 10, totalInteractions: 67 },
  },
  {
    id: "r2",
    caption: "두 번째 릴스",
    coverUrl: "https://example.com/r2.jpg",
    timestamp: "2026-06-02T00:00:00Z",
    insights: { plays: 3000, reach: 2500, likes: 200, comments: 20, shares: 8, saved: 40, totalInteractions: 268 },
  },
]

describe("summarizeReels", () => {
  it("릴스 목록을 집계한다", () => {
    const summary = summarizeReels(SAMPLE_REELS)
    expect(summary).toEqual({
      count: 2,
      totalPlays: 4000,
      totalReach: 3300,
      totalInteractions: 335,
      avgEngagementRate: Number(((335 / 4000) * 100).toFixed(2)),
    })
  })

  it("빈 배열이면 avgEngagementRate 는 0 이다", () => {
    const summary = summarizeReels([])
    expect(summary).toEqual({
      count: 0, totalPlays: 0, totalReach: 0, totalInteractions: 0, avgEngagementRate: 0,
    })
  })
})

describe("toReelsCsv", () => {
  it("BOM 접두와 헤더를 포함한다", () => {
    const csv = toReelsCsv(SAMPLE_REELS)
    expect(csv.startsWith("﻿")).toBe(true)
    const lines = csv.replace("﻿", "").split("\n")
    expect(lines[0]).toBe("캡션,게재일,재생수,도달,좋아요,댓글,공유,저장,총 인터랙션")
  })

  it("각 릴스를 행으로 직렬화한다", () => {
    const csv = toReelsCsv(SAMPLE_REELS)
    const lines = csv.replace("﻿", "").split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe("첫 번째 릴스,2026-06-01T00:00:00Z,1000,800,50,5,2,10,67")
  })
})

describe("serializeReelsReportText", () => {
  it("요약과 릴스별 상세를 포함한 텍스트를 생성한다", () => {
    const text = serializeReelsReportText(SAMPLE_REELS)
    expect(text).toContain("총 릴스: 2개")
    expect(text).toContain("총 재생수: 4,000")
    expect(text).toContain("첫 번째 릴스")
    expect(text).toContain("두 번째 릴스")
  })

  it("빈 배열이면 상세 섹션 없이 요약만 생성한다", () => {
    const text = serializeReelsReportText([])
    expect(text).toContain("총 릴스: 0개")
    expect(text).not.toContain("[릴스별 상세]")
  })
})
