"use client";

import { useRef } from "react";

// Dual-thumb age slider — ported from the design bundle's primitives.jsx.
// Uses the `.range*` classes from app/styles/adflow.css.
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
      <div className="range" ref={trackRef}>
        <div className="range__track" />
        <div className="range__fill" style={{ left: pct(lo) + "%", right: 100 - pct(hi) + "%" }} />
        <div
          className="range__thumb"
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
          className="range__thumb"
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
      <div className="range__values">
        <span>{lo}세</span>
        <span>{hi}세{hi >= max ? "+" : ""}</span>
      </div>
    </div>
  );
}
