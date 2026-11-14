import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prepareInstagramMedia } from "@/lib/instagram-upload"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 })
  if (session.browseMode) {
    return NextResponse.json({ ok: false, error: "둘러보기에서는 파일 업로드를 지원하지 않아요. 로그인하면 저장할 수 있어요." }, { status: 401 })
  }

  let body: { mimeType?: unknown; size?: unknown }
  try {
    const parsed = await req.json()
    body = parsed && typeof parsed === "object" ? (parsed as { mimeType?: unknown; size?: unknown }) : {}
  } catch {
    return NextResponse.json({ ok: false, error: "업로드 정보가 올바르지 않아요." }, { status: 400 })
  }

  const result = await prepareInstagramMedia("video", body.mimeType, body.size)
  return NextResponse.json(result.ok ? result : { ok: false, error: result.error }, { status: result.ok ? 200 : result.status })
}
