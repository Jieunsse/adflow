const GRAPH = "https://graph.facebook.com/v20.0"

export type FbManagedPage = {
  id: string
  name: string
  pictureUrl?: string
}

export const FB_PAGES_MOCK: FbManagedPage[] = [
  { id: "mock-page-a", name: "그린루틴", pictureUrl: "/demo/greenroutine-avatar.svg" },
  { id: "mock-page-b", name: "그린루틴 — 비건 스킨케어", pictureUrl: "/demo/greenroutine-avatar.svg" },
  { id: "mock-page-c", name: "그린루틴 팝업스토어", pictureUrl: "/demo/greenroutine-avatar.svg" },
]

export type FbManagedPagesResult = {
  pages: FbManagedPage[]
  mock: boolean
}

export async function getFacebookManagedPages(
  userToken: string | undefined,
): Promise<FbManagedPagesResult> {
  if (!userToken) return { pages: FB_PAGES_MOCK, mock: true }
  try {
    const res = await fetch(`${GRAPH}/me/accounts?fields=id,name,picture{url}&limit=100&access_token=${userToken}`)
    if (!res.ok) return { pages: FB_PAGES_MOCK, mock: true }
    const data = await res.json() as {
      data?: Array<{
        id: string
        name?: string
        picture?: { data?: { url?: string } }
      }>
    }
    const pages = (data.data ?? []).map(p => ({
      id: p.id,
      name: p.name ?? p.id,
      pictureUrl: p.picture?.data?.url,
    }))
    if (pages.length === 0) return { pages: FB_PAGES_MOCK, mock: true }
    return { pages, mock: false }
  } catch {
    return { pages: FB_PAGES_MOCK, mock: true }
  }
}
