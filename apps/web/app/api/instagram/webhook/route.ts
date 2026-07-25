import { type NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { getSupabaseServer } from "@shared/lib/supabase-server"
import { pushDmEvent } from "@/lib/notifications/dm-registry"

// Meta webhook payload types
type MessagingEvent = {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{ type: string; payload: { url?: string } }>
  }
}

type WebhookEntry = {
  id: string // ig-user-id (비즈니스 계정)
  time: number
  messaging?: MessagingEvent[]
}

type WebhookPayload = {
  object: string
  entry?: WebhookEntry[]
}

// GET: Meta hub challenge 검증
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// POST: 신착 메시지 수신
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // HMAC-SHA256 서명 검증
  const sig = req.headers.get("x-hub-signature-256") ?? ""
  const secret = process.env.META_WEBHOOK_APP_SECRET
  if (!secret) return new Response("Forbidden", { status: 403 })

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return new Response("Forbidden", { status: 403 })
    }
  } catch {
    return new Response("Forbidden", { status: 403 })
  }

  const payload = JSON.parse(rawBody) as WebhookPayload
  if (payload.object !== "instagram") {
    return NextResponse.json({ ok: true })
  }

  // fire-and-forget: 즉시 200 반환 후 처리
  void processEntries(payload.entry ?? [])

  return NextResponse.json({ ok: true })
}

async function processEntries(entries: WebhookEntry[]): Promise<void> {
  const sb = getSupabaseServer()

  for (const entry of entries) {
    const igUserId = entry.id
    for (const event of entry.messaging ?? []) {
      if (!event.message?.mid) continue

      const fromMe = event.sender.id === igUserId
      const participantId = fromMe ? event.recipient.id : event.sender.id
      const attachmentUrl = event.message.attachments?.[0]?.payload?.url

      const conversationId = await deriveConversationId(igUserId, participantId)
      const row = {
        id: event.message.mid,
        ig_user_id: igUserId,
        conversation_id: conversationId,
        participant_id: participantId,
        from_me: fromMe,
        text: event.message.text ?? "",
        attachment_url: attachmentUrl,
        created_at: new Date(event.timestamp).toISOString(),
      }

      // Supabase INSERT (영속 저장)
      if (sb) {
        await sb.from("ig_messages").upsert(row, { onConflict: "id" })
      }

      // SSE push (마케터 브라우저에 실시간 반영)
      pushDmEvent(igUserId, {
        type: "dm_new_message",
        conversationId: row.conversation_id,
        message: {
          id: row.id,
          from_me: row.from_me,
          text: row.text,
          attachment_url: row.attachment_url,
          created_at: row.created_at,
          participant_id: row.participant_id,
        },
      })
    }
  }
}

// Meta webhook은 conversation_id를 직접 주지 않아서
// ig_messages 테이블에서 기존 conversation_id를 역조회하거나,
// 없으면 ig_user_id:participant_id 조합으로 임시 키를 만든다.
// 실제 Graph API conversation_id로 교체는 첫 스레드 열람 시 자동 upsert.
async function deriveConversationId(igUserId: string, participantId: string): Promise<string> {
  const sb = getSupabaseServer()
  if (sb) {
    const { data } = await sb
      .from("ig_messages")
      .select("conversation_id")
      .eq("ig_user_id", igUserId)
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (data?.conversation_id) return data.conversation_id as string
  }
  return `${igUserId}:${participantId}`
}
