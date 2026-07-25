import { type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { addDmController, removeDmController } from "@/lib/notifications/dm-registry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.igUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const igUserId = session.igUserId
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let cleanedUp = false

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl
      addDmController(igUserId, ctrl)

      const keepAlive = setInterval(() => {
        try {
          ctrl.enqueue(new TextEncoder().encode(": ping\n\n"))
        } catch {
          clearInterval(keepAlive)
        }
      }, 15_000)

      const abort = () => {
        if (cleanedUp) return
        cleanedUp = true
        clearInterval(keepAlive)
        if (controller) removeDmController(igUserId, controller)
        try { ctrl.close() } catch {}
        controller = null
      }

      req.signal.addEventListener("abort", abort)
    },
    cancel() {
      if (cleanedUp || !controller) return
      cleanedUp = true
      removeDmController(igUserId, controller)
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
