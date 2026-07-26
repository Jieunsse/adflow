import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramThread, sendInstagramMessage } from "@/lib/instagram-messages"
import { saveIgMessages } from "@/lib/ig-message-store"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await getServerSession(authOptions)
  const data = await getInstagramThread(id, session?.pageId, session?.accessToken, session?.igUserId)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await ctx.params
  const session = await getServerSession(authOptions)
  const body = await req.json() as { recipientId: string; text: string }
  if (!body.recipientId || !body.text?.trim()) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  try {
    const result = await sendInstagramMessage(
      body.recipientId,
      body.text.trim(),
      session?.pageId,
      session?.accessToken,
    )
    // 발송 성공 시 기록 (재연결 시 이력 보존)
    if (result.messageId && session?.igUserId) {
      await saveIgMessages([{
        id: result.messageId,
        igUserId: session.igUserId,
        conversationId,
        participantId: body.recipientId,
        fromMe: true,
        text: body.text.trim(),
        createdAt: new Date().toISOString(),
      }])
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
