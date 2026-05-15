"use client";

import Icon from "@shared/ui/Icon";

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
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
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className={"btn " + (tone === "danger" ? "btn--danger" : "btn--primary")} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
