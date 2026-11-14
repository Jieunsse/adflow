import { type NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { findConversationId, saveIgMessages } from "@/lib/ig-message-store"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parsePayload(rawBody: string): WebhookPayload | null {
  try {
    const value: unknown = JSON.parse(rawBody)
    if (!isRecord(value) || typeof value.object !== "string") return null
    if (value.entry !== undefined && !Array.isArray(value.entry)) return null
    return value as WebhookPayload
  } catch {
    return null
  }
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

  const payload = parsePayload(rawBody)
  if (!payload) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  if (payload.object !== "instagram") {
    return NextResponse.json({ ok: true })
  }

  try {
    await processEntries(payload.entry ?? [])
  } catch (error) {
    console.error("[IG webhook] persistence failed:", error instanceof Error ? error.message : "unknown")
    // Meta 가 재전송할 수 있도록 저장 실패는 성공 ack 로 삼키지 않는다.
    return NextResponse.json({ ok: false, error: "temporary_storage_failure" }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}

async function processEntries(entries: WebhookEntry[]): Promise<void> {
  const rows: Array<{
    id: string
    igUserId: string
    conversationId: string
    participantId: string
    fromMe: boolean
    text: string
    attachmentUrl?: string
    createdAt: string
  }> = []

  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id ||
        (entry.messaging !== undefined && !Array.isArray(entry.messaging))) continue
    const igUserId = entry.id
    for (const event of entry.messaging ?? []) {
      if (!isRecord(event) || !isRecord(event.sender) || !isRecord(event.recipient) ||
          typeof event.sender.id !== "string" || typeof event.recipient.id !== "string" ||
          typeof event.timestamp !== "number" || !Number.isFinite(event.timestamp) ||
          !isRecord(event.message) || typeof event.message.mid !== "string" || !event.message.mid) continue

      const fromMe = event.sender.id === igUserId
      const participantId = fromMe ? event.recipient.id : event.sender.id
      const attachment = Array.isArray(event.message.attachments) ? event.message.attachments[0] : undefined
      const attachmentUrl = isRecord(attachment) && isRecord(attachment.payload) &&
        typeof attachment.payload.url === "string" ? attachment.payload.url : undefined

      const conversationId = await deriveConversationId(igUserId, participantId)
      const row = {
        id: event.message.mid,
        igUserId,
        conversationId,
        participantId,
        fromMe,
        text: typeof event.message.text === "string" ? event.message.text : "",
        attachmentUrl,
        createdAt: new Date(event.timestamp).toISOString(),
      }
      rows.push(row)
    }
  }

  await saveIgMessages(rows)
  for (const row of rows) {
    // SSE push는 영속 저장이 성공한 뒤에만 한다.
    pushDmEvent(row.igUserId, {
      type: "dm_new_message",
      conversationId: row.conversationId,
      message: {
        id: row.id,
        from_me: row.fromMe,
        text: row.text,
        attachment_url: row.attachmentUrl,
        created_at: row.createdAt,
        participant_id: row.participantId,
      },
    })
  }
}

// Meta webhook은 conversation_id를 직접 주지 않아서
// 기존 conversation_id를 역조회하거나, 없으면 ig_user_id:participant_id 조합으로 임시 키를 만든다.
// 실제 Graph API conversation_id로 교체는 첫 스레드 열람 시 자동 저장.
async function deriveConversationId(igUserId: string, participantId: string): Promise<string> {
  return (await findConversationId(igUserId, participantId)) ?? `${igUserId}:${participantId}`
}
