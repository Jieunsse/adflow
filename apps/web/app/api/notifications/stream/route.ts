import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addController, removeController } from "@/lib/notifications/registry";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (session.browseMode || !session.accessToken || !session.adAccountId) {
    return new Response(JSON.stringify({ error: "Meta 계정 연결이 필요해요." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = hashToken(session.accessToken);
  const token = session.accessToken;
  const adAccountId = session.adAccountId;

  let cleanedUp = false;
  let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      activeController = controller;
      const result = addController(userId, token, adAccountId, controller);
      if (!result.added) {
        try { controller.close(); } catch {}
        cleanedUp = true;
        return;
      }
      const abort = () => {
        if (cleanedUp || !activeController) return;
        cleanedUp = true;
        removeController(userId, activeController);
        try { activeController.close(); } catch {}
        activeController = null;
      };
      req.signal.addEventListener("abort", abort);
    },
    cancel() {
      if (cleanedUp || !activeController) return;
      cleanedUp = true;
      removeController(userId, activeController);
      activeController = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
