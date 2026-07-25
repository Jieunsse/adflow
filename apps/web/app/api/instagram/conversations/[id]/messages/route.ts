import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getInstagramThread, sendInstagramMessage } from "@/lib/instagram-messages"
import { getSupabaseServer } from "@shared/lib/supabase-server"

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
    // 발송 성공 시 Supabase에 기록 (재연결 시 이력 보존)
    if (result.messageId && session?.igUserId) {
      const sb = getSupabaseServer()
      if (sb) {
        await sb.from('ig_messages').upsert({
          id: result.messageId,
          ig_user_id: session.igUserId,
          conversation_id: conversationId,
          participant_id: body.recipientId,
          from_me: true,
          text: body.text.trim(),
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      }
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
