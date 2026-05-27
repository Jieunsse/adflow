"use client";

import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import type { ProductEntry } from "@shared/lib/products";

interface Props {
  product: ProductEntry;
  canEdit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProductCard({ product, canEdit = true, onEdit, onDelete }: Props) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1.5px solid var(--w-line-normal)",
        background: "var(--w-bg-elevated)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--w-line-normal)", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 44, height: 44, borderRadius: 8,
              background: "var(--w-bg-alternative)",
              border: "1px solid var(--w-line-alternative)",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}
          >
            <Icon name="image" size={16} style={{ color: "var(--w-fg-alternative)" }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 14px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 2 }}>
            {product.name}
          </div>
          {product.price && (
            <div style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
              {product.price}
            </div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onEdit}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "transparent", cursor: "pointer", font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}
            >
              수정
            </button>
            <button
              type="button"
              onClick={onDelete}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "transparent", cursor: "pointer", font: "500 12px/1 var(--w-font-sans)", color: "var(--w-status-negative)" }}
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {product.description && (
        <p style={{ margin: 0, font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-normal)", whiteSpace: "pre-wrap" }}>
          {product.description}
        </p>
      )}

      {product.targetUrl && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="link" size={11} style={{ color: "var(--w-fg-alternative)", flexShrink: 0 }} />
          <span style={{ font: "500 11.5px/1 var(--w-font-mono)", color: "var(--w-fg-neutral)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {product.targetUrl}
          </span>
        </div>
      )}
    </div>
  );
}
