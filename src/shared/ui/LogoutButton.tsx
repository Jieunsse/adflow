"use client";

import { useRef, useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import Icon from "@shared/ui/Icon";

export default function LogoutButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0 });

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
      const POPUP_WIDTH = 220;
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
  };

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        title="로그아웃"
        style={{
          width: 28, height: 28, borderRadius: 8,
          border: "1px solid var(--w-line-normal)",
          background: "var(--w-bg-elevated)",
          color: "var(--w-fg-neutral)",
          display: "grid", placeItems: "center",
          cursor: "pointer", flex: "0 0 auto",
        }}
      >
        <Icon name="logout" size={13} />
      </button>

      {open && (
        <div style={{
          position: "fixed",
          bottom: popupPos.bottom,
          left: popupPos.left,
          width: 220,
          background: "var(--w-bg-elevated)",
          border: "1px solid var(--w-line-normal)",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 14,
          zIndex: 200,
        }}>
          <div style={{
            font: "600 13px/1.4 var(--w-font-sans)",
            color: "var(--w-fg-strong)",
            marginBottom: 4,
          }}>
            로그아웃하시겠어요?
          </div>
          <div style={{
            font: "500 11.5px/1.4 var(--w-font-sans)",
            color: "var(--w-fg-neutral)",
            marginBottom: 12,
          }}>
            다시 로그인해야 이용할 수 있어요.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--w-line-normal)",
                background: "var(--w-bg-elevated)",
                color: "var(--w-fg-strong)",
                font: "600 12.5px/1 var(--w-font-sans)",
                cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background: "var(--w-status-negative)",
                color: "#fff",
                font: "600 12.5px/1 var(--w-font-sans)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              <Icon name="logout" size={12} />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
