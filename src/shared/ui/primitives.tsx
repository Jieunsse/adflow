// Shared presentational primitives — ported from the design bundle's primitives.jsx.
import type { ReactNode } from "react";
import Icon from "./Icon";

/* ── Badge ─────────────────────────────────────────────────────────── */

export type BadgeKind = "neutral" | "accent" | "success" | "warn" | "neg" | "violet" | "inverse";

export function Badge({
  kind = "neutral",
  live,
  dot,
  size,
  children,
}: {
  kind?: BadgeKind;
  live?: boolean;
  dot?: boolean;
  size?: "sm";
  children: ReactNode;
}) {
  return (
    <span className={`badge badge--${kind}${size ? ` badge--${size}` : ""}`}>
      {dot && <span className={"badge__dot" + (live ? " badge__dot--live" : "")} />}
      {children}
    </span>
  );
}

/* ── Sparkline (mini line chart) ───────────────────────────────────── */

export function Sparkline({
  data,
  color = "var(--w-primary-normal)",
  fill = false,
  height = 28,
}: {
  data: number[] | null | undefined;
  color?: string;
  fill?: boolean;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── KPI card ──────────────────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  suffix,
  delta,
  up,
  down,
  trend,
  color = "var(--w-primary-normal)",
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: string;
  up?: boolean;
  down?: boolean;
  trend?: number[];
  color?: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="kpi__value">
          {value}
          {suffix && <span className="kpi__suffix">{suffix}</span>}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        {delta && (
          <span className={"kpi__delta " + (down ? "kpi__delta--down" : "kpi__delta--up")}>
            <Icon name={down ? "trend-down" : "trend-up"} size={14} /> {delta}
          </span>
        )}
      </div>
      <div className="kpi__spark"><Sparkline data={trend} color={color} fill /></div>
    </div>
  );
}

/* ── EmptyState placeholder ────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {icon && (
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-bg-alternative)", display: "grid", placeItems: "center", color: "var(--w-fg-neutral)" }}>
          {icon}
        </div>
      )}
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      {desc && <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 360 }}>{desc}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
