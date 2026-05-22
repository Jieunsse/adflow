"use client";

import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";

export default function ConfirmModal({
  title,
  desc,
  confirmLabel,
  cancelLabel = "취소",
  tone,
  onClose,
  onConfirm,
}: {
  title: string;
  desc: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone: "primary" | "danger";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]"
      onClick={onClose}
    >
      <div
        className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease]"
        style={{ width: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "26px 26px 8px" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: tone === "danger" ? "rgba(255,66,66,0.10)" : "var(--w-primary-soft)",
              color: tone === "danger" ? "var(--w-status-negative)" : "var(--w-primary-press)",
              display: "grid",
              placeItems: "center",
              marginBottom: 14,
            }}
          >
            <Icon name={tone === "danger" ? "warn" : "info"} size={20} />
          </div>
          <h3 style={{ font: "700 17px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em", margin: 0 }}>
            {title}
          </h3>
          <div style={{ font: "500 13.5px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 0" }}>
            {desc}
          </div>
        </div>
        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
          <Button variant="ghost" type="button" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
