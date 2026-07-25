import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

const GRAPH = "https://graph.facebook.com/v20.0"
const IG_GRAPH = "https://graph.instagram.com"

type PagePictureRes = { picture?: { data?: { url?: string } } }
type IgPictureRes = { profile_picture_url?: string }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken && !session?.igAccessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pageId = session.pageId
  const igAccessToken = session.igAccessToken

  const [pageJson, igJson] = await Promise.all([
    pageId && session.accessToken
      ? fetch(`${GRAPH}/${pageId}?fields=picture.type(large)&access_token=${session.accessToken}`)
          .then(r => (r.ok ? (r.json() as Promise<PagePictureRes>) : null))
          .catch(() => null)
      : Promise.resolve(null),
    igAccessToken
      ? fetch(`${IG_GRAPH}/me?fields=profile_picture_url&access_token=${igAccessToken}`)
          .then(r => (r.ok ? (r.json() as Promise<IgPictureRes>) : null))
          .catch(() => null)
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    pagePicture: pageJson?.picture?.data?.url ?? null,
    igPicture: igJson?.profile_picture_url ?? null,
  })
}
