import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceSession } from "@/lib/meta-session"
import { getInstagramThread, getMockThread, sendInstagramMessage } from "@/lib/instagram-messages"
import { saveIgMessages } from "@/lib/ig-message-store"
import { MetaGraphError } from "@/lib/instagram-graph"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  if (session.browseMode) return NextResponse.json(getMockThread(id))
  try {
    const data = await getInstagramThread(
      id,
      session.pageId,
      session.accessToken,
      session.igUserId,
      session.igAccessToken,
    )
    return NextResponse.json(data)
  } catch (error) {
    const status = error instanceof MetaGraphError && error.status >= 400 ? error.status : 502
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Instagram 대화 조회 실패", status }, { status })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await ctx.params
  let session
  try {
    session = await getWorkspaceSession(await getServerSession(authOptions))
  } catch {
    return NextResponse.json({ ok: false, error: "Instagram 세션을 확인하지 못했어요." }, { status: 502 })
  }
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "요청 본문을 읽지 못했어요." }, { status: 400 })
  }
  const body = rawBody && typeof rawBody === "object" ? rawBody as { recipientId?: unknown; text?: unknown } : {}
  const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : ""
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!recipientId || !text) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (session.browseMode) return NextResponse.json({ ok: true, messageId: `mock-${Date.now()}`, mock: true })
  try {
    const result = await sendInstagramMessage(
      recipientId,
      text,
      session?.pageId,
      session?.accessToken,
      session?.igUserId,
      session?.igAccessToken,
    )
    // 발송 성공 시 기록 (재연결 시 이력 보존)
    if (result.messageId && session?.igUserId) {
      try {
        await saveIgMessages([{
          id: result.messageId,
          igUserId: session.igUserId,
          conversationId,
          participantId: recipientId,
          fromMe: true,
          text,
          createdAt: new Date().toISOString(),
        }])
      } catch (error) {
        console.error("[Instagram DM] sent but cache save failed", error)
      }
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send_failed'
    const status = e instanceof MetaGraphError && e.status >= 400 ? e.status : 502
    return NextResponse.json({ ok: false, error: msg, status }, { status })
  }
}
