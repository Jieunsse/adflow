import { GRAPH, MetaGraphError, graphErrorMessage, graphStatus, hasGraphError, readGraphBody } from "./instagram-graph"

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
  if (!userToken) throw new MetaGraphError("Facebook 로그인이 필요합니다.", 401, { code: "missing_credentials" })
  const res = await fetch(`${GRAPH}/me/accounts?fields=id,name,picture{url}&limit=100&access_token=${userToken}`, { cache: "no-store" })
  const data = await readGraphBody(res) as {
      data?: Array<{
        id: string
        name?: string
        picture?: { data?: { url?: string } }
      }>
      error?: { message?: string }
  }
  if (!res.ok || hasGraphError(data)) {
    throw new MetaGraphError(graphErrorMessage(data, "Facebook 페이지 조회 실패"), graphStatus(res.status, data), data)
  }
    const pages = (data.data ?? []).map(p => ({
      id: p.id,
      name: p.name ?? p.id,
      pictureUrl: p.picture?.data?.url,
    }))
    return { pages, mock: false }
}
