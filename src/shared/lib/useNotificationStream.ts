"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { addNotification, type NotifType } from "./notifications";

interface AdStatusMessage {
  id: string;
  type: "ad-status";
  message: string;
  ts: number;
  adId: string;
  campaignId: string;
  transition: string;
}

interface AuthExpiredMessage {
  type: "auth_expired";
}

type StreamMessage = AdStatusMessage | AuthExpiredMessage;

function isStreamMessage(v: unknown): v is StreamMessage {
  if (!v || typeof v !== "object") return false;
  const t = (v as { type?: unknown }).type;
  return t === "ad-status" || t === "auth_expired";
}

export function useNotificationStream() {
  const { data: session, status } = useSession();
  const ready = status === "authenticated" && !!session?.accessToken && !!session?.adAccountId && !session?.browseMode;

  useEffect(() => {
    if (!ready) return;
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!isStreamMessage(parsed)) return;
      if (parsed.type === "auth_expired") {
        es.close();
        signOut({ callbackUrl: "/login" });
        return;
      }
      addNotification({
        id: parsed.id,
        type: "ad-status" as NotifType,
        message: parsed.message,
        ts: parsed.ts,
        adId: parsed.adId,
        campaignId: parsed.campaignId,
        transition: parsed.transition,
      });
    };
    es.onerror = () => {};
    return () => es.close();
  }, [ready]);
}
