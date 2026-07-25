"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@shared/ui/Icon";
import type { FbManagedPage } from "@/lib/facebook-pages";

export default function PageSwitcher({
  pages,
  activeId,
  onSelect,
}: {
  pages: FbManagedPage[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
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

  const active = pages.find((p) => p.id === activeId) ?? pages[0];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 bg-[var(--w-bg-elevated)] border rounded-[12px] pl-2 pr-3 py-1.5 transition-colors hover:border-[var(--w-line-strong)]"
        style={{
          borderColor: open ? "var(--w-primary-normal)" : "var(--w-line-normal)",
          boxShadow: open ? "0 0 0 4px rgba(0,102,255,0.14)" : "none",
        }}
      >
        {active?.pictureUrl ? (
          <img src={active.pictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[var(--w-bg-neutral)]" />
        )}
        <span className="font-medium text-[14px] text-[var(--w-fg-strong)]">{active?.name ?? "페이지 선택"}</span>
        <Icon
          name="chev-down"
          size={14}
          style={{
            color: "var(--w-fg-alternative)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[200] min-w-[260px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[12px] p-1 flex flex-col"
          style={{ boxShadow: "0 8px 24px rgba(23,23,23,0.10)" }}
        >
          {pages.map((p) => {
            const isActive = p.id === active?.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { onSelect(p.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[8px] text-left transition-colors"
                style={{
                  background: isActive ? "var(--w-primary-soft)" : "transparent",
                  color: isActive ? "var(--w-primary-press)" : "var(--w-fg-normal)",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--w-bg-neutral)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {p.pictureUrl ? (
                  <img src={p.pictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--w-bg-neutral)]" />
                )}
                <span className="flex-1 font-medium text-[14px]">{p.name}</span>
                {isActive && <Icon name="check" size={14} style={{ color: "var(--w-primary-normal)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
