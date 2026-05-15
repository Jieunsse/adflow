"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ value, onChange, options, placeholder = "선택해주세요" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "var(--w-bg-elevated)",
          border: `1px solid ${open ? "var(--w-primary-normal)" : "var(--w-line-normal)"}`,
          boxShadow: open ? "0 0 0 4px rgba(0,102,255,0.14)" : "none",
          borderRadius: 12,
          padding: "12px 14px",
          font: "500 14px/1.5 var(--w-font-sans)",
          letterSpacing: "0.004em",
          color: selected ? "var(--w-fg-strong)" : "var(--w-fg-alternative)",
          cursor: "pointer",
          textAlign: "left",
          transition: "border-color 120ms ease, box-shadow 120ms ease",
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <Icon
          name="chev-down"
          size={16}
          style={{
            color: "var(--w-fg-alternative)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: "var(--w-bg-elevated)",
            border: "1px solid var(--w-line-normal)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(23,23,23,0.10)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: active ? "var(--w-primary-soft)" : "transparent",
                  color: active ? "var(--w-primary-press)" : "var(--w-fg-normal)",
                  font: "500 14px/1 var(--w-font-sans)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--w-bg-neutral)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span>{o.label}</span>
                {active && <Icon name="check" size={14} style={{ color: "var(--w-primary-normal)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
