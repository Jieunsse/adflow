import { GRAPH, IG_GRAPH, getPageToken, getIgUserId } from "./instagram-graph"

export type IgReelInsights = {
  plays: number
  reach: number
  likes: number
  comments: number
  shares: number
  saved: number
  totalInteractions: number
}

export type IgReel = {
  id: string
  caption: string
  coverUrl: string
  permalink?: string
  timestamp: string
  insights: IgReelInsights
}

export type IgReelsPanel = {
  reels: IgReel[]
  mock: boolean
}

export const IG_REELS_MOCK: IgReelsPanel = {
  mock: true,
  reels: [
    {
      id: "reel-mock-1",
      caption: "비건 수분 크림 언박싱 🎁 순하게 채우는 하루",
      coverUrl: "/demo/library/cream.jpg",
      permalink: "https://www.instagram.com/reel/mock-1/",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      insights: { plays: 18400, reach: 15200, likes: 942, comments: 87, shares: 63, saved: 210, totalInteractions: 1302 },
    },
    {
      id: "reel-mock-2",
      caption: "고객 리뷰 모음 💬 민감성 피부 진짜 후기만",
      coverUrl: "/demo/library/pad.jpg",
      permalink: "https://www.instagram.com/reel/mock-2/",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      insights: { plays: 7200, reach: 6100, likes: 318, comments: 24, shares: 12, saved: 55, totalInteractions: 409 },
    },
    {
      id: "reel-mock-3",
      caption: "식물성 세럼 제작 비하인드 🎬 이렇게 만들어져요",
      coverUrl: "/demo/library/serum.jpg",
      permalink: "https://www.instagram.com/reel/mock-3/",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      insights: { plays: 42100, reach: 33800, likes: 2104, comments: 156, shares: 231, saved: 487, totalInteractions: 2978 },
    },
    {
      id: "reel-mock-4",
      caption: "이번 주 비건 토너 리필 기획전 안내",
      coverUrl: "/demo/library/toner.jpg",
      permalink: "https://www.instagram.com/reel/mock-4/",
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      insights: { plays: 3100, reach: 2700, likes: 98, comments: 6, shares: 3, saved: 14, totalInteractions: 121 },
    },
    {
      id: "reel-mock-5",
      caption: "비건 클렌저 사용법 튜토리얼 — 3분이면 끝",
      coverUrl: "/demo/library/cleanser.jpg",
      permalink: "https://www.instagram.com/reel/mock-5/",
      timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      insights: { plays: 12800, reach: 10500, likes: 654, comments: 41, shares: 29, saved: 133, totalInteractions: 857 },
    },
    {
      id: "reel-mock-6",
      caption: "브랜드 스토리 — 우리가 비건 스킨케어를 시작한 이유",
      coverUrl: "/demo/library/pack.jpg",
      permalink: "https://www.instagram.com/reel/mock-6/",
      timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      insights: { plays: 25600, reach: 20300, likes: 1187, comments: 93, shares: 78, saved: 264, totalInteractions: 1622 },
    },
  ],
}

type ReelMediaRaw = {
  id: string
  caption?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  media_product_type?: string
}

async function fetchReelInsights(reelId: string, token: string, graphBase: string): Promise<IgReelInsights> {
  const empty: IgReelInsights = { plays: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, totalInteractions: 0 }
  try {
    const res = await fetch(
      `${graphBase}/${reelId}/insights?metric=plays,reach,likes,comments,shares,saved,total_interactions&access_token=${token}`
    )
    if (!res.ok) return empty
    const body = await res.json() as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>
    }
    const pick = (name: string) => body.data?.find(d => d.name === name)?.values[0]?.value ?? 0
    return {
      plays: pick("plays"),
      reach: pick("reach"),
      likes: pick("likes"),
      comments: pick("comments"),
      shares: pick("shares"),
      saved: pick("saved"),
      totalInteractions: pick("total_interactions"),
    }
  } catch {
    return empty
  }
}

export async function fetchReelsPanel(creds: { igUserId: string; token: string; graphBase: string }): Promise<IgReelsPanel> {
  const { igUserId, token, graphBase } = creds
  const listRes = await fetch(
    `${graphBase}/${igUserId}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,media_product_type&limit=25&access_token=${token}`
  )
  if (!listRes.ok) throw new Error(`reels API ${listRes.status}`)

  const listBody = await listRes.json() as { data?: ReelMediaRaw[] }
  const raws = (listBody.data ?? []).filter(m => m.media_product_type === "REELS")

  const reels: IgReel[] = await Promise.all(
    raws.map(async (m): Promise<IgReel> => ({
      id: m.id,
      caption: m.caption ?? "",
      coverUrl: m.thumbnail_url ?? m.media_url ?? "",
      permalink: m.permalink,
      timestamp: m.timestamp ?? "",
      insights: await fetchReelInsights(m.id, token, graphBase),
    }))
  )

  return { reels, mock: false }
}

export type ReelsSummary = {
  count: number
  totalPlays: number
  totalReach: number
  totalInteractions: number
  avgEngagementRate: number
}

export function summarizeReels(reels: IgReel[]): ReelsSummary {
  const totalPlays = reels.reduce((s, r) => s + r.insights.plays, 0)
  const totalReach = reels.reduce((s, r) => s + r.insights.reach, 0)
  const totalInteractions = reels.reduce((s, r) => s + r.insights.totalInteractions, 0)
  const avgEngagementRate = totalPlays > 0 ? Number(((totalInteractions / totalPlays) * 100).toFixed(2)) : 0
  return { count: reels.length, totalPlays, totalReach, totalInteractions, avgEngagementRate }
}

export function serializeReelsReportText(reels: IgReel[]): string {
  const summary = summarizeReels(reels)
  const lines: string[] = []
  lines.push("릴스 리포트")
  lines.push("")
  lines.push(`총 릴스: ${summary.count}개`)
  lines.push(`총 재생수: ${summary.totalPlays.toLocaleString("ko-KR")}`)
  lines.push(`총 도달: ${summary.totalReach.toLocaleString("ko-KR")}`)
  lines.push(`총 인터랙션: ${summary.totalInteractions.toLocaleString("ko-KR")}`)
  lines.push(`평균 참여율: ${summary.avgEngagementRate}%`)

  if (reels.length > 0) {
    lines.push("")
    lines.push("[릴스별 상세]")
    reels.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.caption || "(캡션 없음)"} — 재생 ${r.insights.plays.toLocaleString("ko-KR")} / 인터랙션 ${r.insights.totalInteractions.toLocaleString("ko-KR")}`)
    })
  }

  return lines.join("\n")
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const REELS_CSV_HEADERS = ["캡션", "게재일", "재생수", "도달", "좋아요", "댓글", "공유", "저장", "총 인터랙션"]

export function toReelsCsv(reels: IgReel[]): string {
  const lines = [REELS_CSV_HEADERS.join(",")]
  for (const r of reels) {
    lines.push(
      [
        csvCell(r.caption),
        csvCell(r.timestamp),
        csvCell(r.insights.plays),
        csvCell(r.insights.reach),
        csvCell(r.insights.likes),
        csvCell(r.insights.comments),
        csvCell(r.insights.shares),
        csvCell(r.insights.saved),
        csvCell(r.insights.totalInteractions),
      ].join(","),
    )
  }
  return "﻿" + lines.join("\n")
}

export async function getInstagramReels(
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
  igAccessToken?: string,
): Promise<IgReelsPanel> {
  if (igAccessToken && igUserIdHint) {
    return await fetchReelsPanel({ igUserId: igUserIdHint, token: igAccessToken, graphBase: IG_GRAPH })
  }
  if (!pageId || !userToken) throw new Error("IG 계정이 연결되지 않았어요")
  const pageToken = await getPageToken(pageId, userToken)
  if (!pageToken) throw new Error("페이지 토큰 획득 실패")
  const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
  if (!igUserId) throw new Error("IG 사용자 ID 없음")
  return await fetchReelsPanel({ igUserId, token: pageToken, graphBase: GRAPH })
}
