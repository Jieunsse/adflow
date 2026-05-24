export const GRAPH = "https://graph.facebook.com/v20.0"
// Instagram Business Login 토큰(IGAAX...)은 이 엔드포인트 전용
export const IG_GRAPH = "https://graph.instagram.com"

export async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`)
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

export async function getIgUserId(pageId: string, pageToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`)
    const data = await res.json() as { instagram_business_account?: { id: string } }
    return data.instagram_business_account?.id ?? null
  } catch {
    return null
  }
}
