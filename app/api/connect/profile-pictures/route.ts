import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

const GRAPH = "https://graph.facebook.com/v20.0"

type PagePictureRes = { picture?: { data?: { url?: string } } }
type IgPictureRes = { profile_picture_url?: string }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = session.accessToken
  const pageId = session.pageId
  const igUserId = session.igUserId

  const [pageJson, igJson] = await Promise.all([
    pageId
      ? fetch(`${GRAPH}/${pageId}?fields=picture.type(large)&access_token=${token}`)
          .then(r => (r.ok ? (r.json() as Promise<PagePictureRes>) : null))
          .catch(() => null)
      : Promise.resolve(null),
    igUserId
      ? fetch(`${GRAPH}/${igUserId}?fields=profile_picture_url&access_token=${token}`)
          .then(r => (r.ok ? (r.json() as Promise<IgPictureRes>) : null))
          .catch(() => null)
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    pagePicture: pageJson?.picture?.data?.url ?? null,
    igPicture: igJson?.profile_picture_url ?? null,
  })
}
