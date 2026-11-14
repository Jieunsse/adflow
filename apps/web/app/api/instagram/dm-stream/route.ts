import { type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { readIgMessages } from "@/lib/ig-message-store"
import { addDmController, removeDmController } from "@/lib/notifications/dm-registry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
const POLL_INTERVAL_MS = 5_000

function encodeEvent(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

function messageEvent(row: {
  id: string
  conversationId: string
  fromMe: boolean
  text?: string
  attachmentUrl?: string
  createdAt: string
  participantId: string
}) {
  return {
    type: "dm_new_message",
    conversationId: row.conversationId,
    message: {
      id: row.id,
      from_me: row.fromMe,
      text: row.text ?? "",
      attachment_url: row.attachmentUrl,
      created_at: row.createdAt,
      participant_id: row.participantId,
    },
  }
}

function eventMessageId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined
  const message = (payload as { message?: unknown }).message
  if (typeof message !== "object" || message === null) return undefined
  const id = (message as { id?: unknown }).id
  return typeof id === "string" ? id : undefined
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.igUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const igUserId = session.igUserId
  const knownMessageIds = new Set((await readIgMessages(igUserId)).map((row) => row.id))
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let cleanedUp = false
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl
      addDmController(igUserId, ctrl, (payload) => {
        const id = eventMessageId(payload)
        if (id) knownMessageIds.add(id)
      })

      const poll = async () => {
        if (cleanedUp) return
        const rows = (await readIgMessages(igUserId)).reverse()
        for (const row of rows) {
          if (cleanedUp) return
          if (knownMessageIds.has(row.id)) continue
          knownMessageIds.add(row.id)
          ctrl.enqueue(encodeEvent(messageEvent(row)))
        }
      }
      let pollInFlight = false
      const pollTimer = setInterval(() => {
        if (pollInFlight || cleanedUp) return
        pollInFlight = true
        poll().catch(() => {}).finally(() => { pollInFlight = false })
      }, POLL_INTERVAL_MS)

      const keepAlive = setInterval(() => {
        try {
          ctrl.enqueue(new TextEncoder().encode(": ping\n\n"))
        } catch {
          clearInterval(keepAlive)
        }
      }, 15_000)

      cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        clearInterval(keepAlive)
        clearInterval(pollTimer)
        if (controller) removeDmController(igUserId, controller)
        controller = null
      }

      const abort = () => {
        cleanup?.()
        try { ctrl.close() } catch {}
      }

      req.signal.addEventListener("abort", abort)
    },
    cancel() {
      cleanup?.()
      controller = null
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
