"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "@shared/ui/Icon";
import { useNotifications, type Notification } from "@shared/lib/notifications";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "방금";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${Math.floor(diff / 86400000)}일 전`;
}

const TYPE_ICON: Record<string, IconName> = {
  launch: "megaphone",
  opt: "sparkles",
  perf: "message",
  weekly: "doc",
  "ad-status": "bell",
  "auto-relaunch-ready": "sparkles",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0 });
  const { notifs, readSet, unreadCount, markAllRead } = useNotifications();
  const router = useRouter();

  const handleNotifClick = (n: Notification) => {
    if (n.type === "ad-status" && n.campaignId) {
      setOpen(false);
      router.push(`/campaigns/${n.campaignId}`);
    } else if (n.type === "auto-relaunch-ready" && n.campaignId) {
      setOpen(false);
      router.push(`/campaigns/${n.campaignId}?relaunch=1`);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const POPUP_WIDTH = 300;
      const MARGIN = 12;
      const left = Math.min(
        Math.max(rect.left, MARGIN),
        window.innerWidth - POPUP_WIDTH - MARGIN,
      );
      setPopupPos({
        bottom: window.innerHeight - rect.top + 8,
        left,
      });
    }
    setOpen(next);
    if (next) markAllRead();
  };

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        title="알림"
        style={{
          width: 28, height: 28, borderRadius: 8,
          border: "1px solid var(--w-line-normal)",
          background: "var(--w-bg-elevated)",
          color: "var(--w-fg-neutral)",
          display: "grid", placeItems: "center",
          cursor: "pointer", flex: "0 0 auto",
          position: "relative",
        }}
      >
        <Icon name="bell" size={13} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 999,
            background: "var(--w-status-negative)", color: "#fff",
            font: "700 10px/16px var(--w-font-sans)",
            textAlign: "center", padding: "0 3px",
            border: "2px solid var(--w-bg-base)",
            pointerEvents: "none",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "fixed",
          bottom: popupPos.bottom,
          left: popupPos.left,
          width: 300,
          background: "var(--w-bg-elevated)",
          border: "1px solid var(--w-line-normal)",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
          zIndex: 200,
        }}>
          <div style={{
            padding: "12px 16px 10px",
            font: "600 13px/1 var(--w-font-sans)",
            color: "var(--w-fg-strong)",
            borderBottom: "1px solid var(--w-line-alternative)",
          }}>
            알림
          </div>
          {notifs.length === 0 ? (
            <div style={{
              padding: "28px 16px",
              textAlign: "center",
              font: "500 13px/1.5 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
            }}>
              새 알림이 없어요
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {notifs.map((n) => (
                <NotifRow key={n.id} notif={n} isRead={readSet.has(n.id)} onClick={() => handleNotifClick(n)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifRow({ notif, isRead, onClick }: { notif: Notification; isRead: boolean; onClick?: () => void }) {
  const clickable = (notif.type === "ad-status" || notif.type === "auto-relaunch-ready") && !!notif.campaignId;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex", gap: 10, padding: "10px 16px",
        borderBottom: "1px solid var(--w-line-alternative)",
        background: isRead ? "transparent" : "var(--w-primary-soft)",
        cursor: clickable ? "pointer" : "default",
      }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: "var(--w-bg-alternative)", color: "var(--w-fg-normal)",
        display: "grid", placeItems: "center",
      }}>
        <Icon name={TYPE_ICON[notif.type] ?? "bell"} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{notif.message}</div>
        <div style={{ font: "500 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{timeAgo(notif.ts)}</div>
      </div>
      {!isRead && (
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--w-primary-normal)", flexShrink: 0, marginTop: 6 }} />
      )}
    </div>
  );
}
