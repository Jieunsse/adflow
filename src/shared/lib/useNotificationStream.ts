"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { addNotification } from "./notifications";
import type { WinnerEvidence } from "@entities/insights/winner-types";

interface AdStatusMessage {
  id: string;
  type: "ad-status";
  message: string;
  ts: number;
  adId: string;
  campaignId: string;
  transition: string;
}

interface AutoRelaunchReadyMessage {
  id: string;
  type: "auto-relaunch-ready";
  message: string;
  ts: number;
  campaignId: string;
  campaignName: string;
  evidence: WinnerEvidence;
}

interface AuthExpiredMessage {
  type: "auth_expired";
}

type StreamMessage = AdStatusMessage | AutoRelaunchReadyMessage | AuthExpiredMessage;

function isStreamMessage(v: unknown): v is StreamMessage {
  if (!v || typeof v !== "object") return false;
  const t = (v as { type?: unknown }).type;
  return t === "ad-status" || t === "auth_expired" || t === "auto-relaunch-ready";
}

function isAutoRelaunchEnabled(campaignId: string): boolean {
  try {
    const raw = localStorage.getItem(`auto-relaunch:${campaignId}`);
    if (!raw) return false;
    return (JSON.parse(raw) as { enabled?: boolean }).enabled === true;
  } catch {
    return false;
  }
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
      if (parsed.type === "auto-relaunch-ready") {
        // 클라가 localStorage 보고 토글 켜진 캠페인만 알림 표시. 서버는 토글 상태 모름 (ADR-012 §Decision 8).
        if (isAutoRelaunchEnabled(parsed.campaignId)) {
          addNotification({
            id: parsed.id,
            type: "auto-relaunch-ready",
            message: parsed.message,
            ts: parsed.ts,
            campaignId: parsed.campaignId,
            evidence: parsed.evidence,
          });
        }
        return;
      }
      addNotification({
        id: parsed.id,
        type: "ad-status",
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
