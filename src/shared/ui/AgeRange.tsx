"use client";

import { useRef } from "react";

// Dual-thumb age slider — ported from the design bundle's primitives.jsx.
export default function AgeRange({
  value,
  onChange,
  min = 18,
  max = 65,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  min?: number;
  max?: number;
}) {
  const [lo, hi] = value;
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  function start(which: "lo" | "hi", e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = "touches" in ev ? ev.touches[0]?.clientX ?? 0 : ev.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const v = Math.round(min + ratio * (max - min));
      if (which === "lo") onChange([Math.min(v, hi - 1), hi]);
      else onChange([lo, Math.max(v, lo + 1)]);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }

  return (
    <div>
      <div className="relative h-9 flex items-center" ref={trackRef}>
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--w-bg-neutral)]" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--w-primary-normal)]" style={{ left: pct(lo) + "%", right: 100 - pct(hi) + "%" }} />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] bg-white border-2 border-[var(--w-primary-normal)] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.12)] cursor-grab active:cursor-grabbing"
          style={{ left: pct(lo) + "%" }}
          role="slider"
          aria-label="최소 연령"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={lo}
          onMouseDown={(e) => start("lo", e)}
          onTouchStart={(e) => start("lo", e)}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] bg-white border-2 border-[var(--w-primary-normal)] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.12)] cursor-grab active:cursor-grabbing"
          style={{ left: pct(hi) + "%" }}
          role="slider"
          aria-label="최대 연령"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hi}
          onMouseDown={(e) => start("hi", e)}
          onTouchStart={(e) => start("hi", e)}
        />
      </div>
      <div className="flex justify-between mt-1.5 font-semibold text-[12px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-neutral)]">
        <span>{lo}세</span>
        <span>{hi}세{hi >= max ? "+" : ""}</span>
      </div>
    </div>
  );
}
