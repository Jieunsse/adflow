// PROTOTYPE — throwaway. 라우트 변형 토글용 floating pill. 승자 확정 후 삭제.
"use client";

import { useEffect } from "react";
import Icon from "./Icon";

export interface PrototypeVariant {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: PrototypeVariant[];
  current: string;
  onChange: (key: string) => void;
}) {
  const idx = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const go = (delta: number) => {
    const next = (idx + delta + variants.length) % variants.length;
    onChange(variants[next].key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el?.isContentEditable
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  const active = variants[idx];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full border border-[var(--w-line-strong)] bg-[var(--w-bg-inverse)] text-[var(--w-fg-inverse)] pl-1.5 pr-1.5 py-1.5 shadow-[var(--w-shadow-card)]">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="이전 변형"
        className="grid place-items-center w-7 h-7 rounded-full hover:bg-white/15"
      >
        <Icon name="arrow-left" size={15} />
      </button>
      <span className="px-2 font-semibold text-[13px] leading-none tabular-nums min-w-[140px] text-center">
        {active.key} — {active.name}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="다음 변형"
        className="grid place-items-center w-7 h-7 rounded-full hover:bg-white/15"
      >
        <Icon name="arrow-right" size={15} />
      </button>
    </div>
  );
}
