const GRAPH = "https://graph.facebook.com/v20.0"

export type IgStoryInsights = {
  impressions: number
  reach: number
  replies: number
  profileVisits: number
}

export type IgStory = {
  id: string
  mediaType: "IMAGE" | "VIDEO"
  mediaUrl?: string
  thumbnailUrl?: string
  timestamp: string
  insights: IgStoryInsights
}

export type IgStoriesPanel = {
  stories: IgStory[]
  mock: boolean
}

export const IG_STORIES_MOCK: IgStoriesPanel = {
  mock: true,
  stories: [
    {
      id: "story-mock-1",
      mediaType: "IMAGE",
      mediaUrl: "https://picsum.photos/seed/story1/360/640",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      insights: { impressions: 1240, reach: 980, replies: 4, profileVisits: 23 },
    },
    {
      id: "story-mock-2",
      mediaType: "VIDEO",
      mediaUrl: "",
      thumbnailUrl: "https://picsum.photos/seed/story2/360/640",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      insights: { impressions: 850, reach: 720, replies: 0, profileVisits: 18 },
    },
    {
      id: "story-mock-3",
      mediaType: "IMAGE",
      mediaUrl: "https://picsum.photos/seed/story3/360/640",
      timestamp: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
      insights: { impressions: 2100, reach: 1600, replies: 12, profileVisits: 56 },
    },
  ],
}

async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`)
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

async function getIgUserId(pageId: string, pageToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`)
    const data = await res.json() as { instagram_business_account?: { id: string } }
    return data.instagram_business_account?.id ?? null
  } catch {
    return null
  }
}

type StoryMediaRaw = {
  id: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  timestamp?: string
}

async function fetchStoryInsights(storyId: string, token: string): Promise<IgStoryInsights> {
  try {
    const res = await fetch(
      `${GRAPH}/${storyId}/insights?metric=impressions,reach,replies,profile_visits&access_token=${token}`
    )
    if (!res.ok) return { impressions: 0, reach: 0, replies: 0, profileVisits: 0 }
    const body = await res.json() as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>
    }
    const pick = (name: string) => body.data?.find(d => d.name === name)?.values[0]?.value ?? 0
    return {
      impressions: pick("impressions"),
      reach: pick("reach"),
      replies: pick("replies"),
      profileVisits: pick("profile_visits"),
    }
  } catch {
    return { impressions: 0, reach: 0, replies: 0, profileVisits: 0 }
  }
}

async function fetchStoriesWithToken(igUserId: string, token: string): Promise<IgStoriesPanel> {
  const listRes = await fetch(
    `${GRAPH}/${igUserId}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&limit=25&access_token=${token}`
  )
  if (!listRes.ok) return IG_STORIES_MOCK

  const listBody = await listRes.json() as { data?: StoryMediaRaw[] }
  const raws = listBody.data ?? []

  // 활성 스토리 0건은 mock 이 아니라 실제 비어있는 정상 케이스. empty state.
  if (raws.length === 0) return { stories: [], mock: false }

  const stories: IgStory[] = await Promise.all(
    raws.map(async (m): Promise<IgStory> => ({
      id: m.id,
      mediaType: m.media_type === "VIDEO" ? "VIDEO" : "IMAGE",
      mediaUrl: m.media_url,
      thumbnailUrl: m.thumbnail_url,
      timestamp: m.timestamp ?? "",
      insights: await fetchStoryInsights(m.id, token),
    }))
  )

  return { stories, mock: false }
}

export async function getInstagramActiveStories(
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
  igAccessToken?: string,
): Promise<IgStoriesPanel> {
  if (igAccessToken && igUserIdHint) {
    try {
      return await fetchStoriesWithToken(igUserIdHint, igAccessToken)
    } catch {
      return IG_STORIES_MOCK
    }
  }

  if (!pageId || !userToken) return IG_STORIES_MOCK
  try {
    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return IG_STORIES_MOCK

    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    if (!igUserId) return IG_STORIES_MOCK

    return await fetchStoriesWithToken(igUserId, pageToken)
  } catch {
    return IG_STORIES_MOCK
  }
}
