import type { ReactNode } from "react";
import Icon from "./Icon";
import { cn } from "@shared/lib/cn";
import { Card } from "./Card";

/* ── Badge ─────────────────────────────────────────────────────────── */

export type BadgeKind =
  | "neutral"
  | "accent"
  | "success"
  | "warn"
  | "neg"
  | "violet"
  | "inverse";

const BADGE_BASE =
  "inline-flex items-center gap-[5px] self-start px-[9px] py-1 rounded-full font-semibold text-[11.5px] leading-none tracking-[0.008em] border border-transparent";

const BADGE_VARIANT: Record<BadgeKind, string> = {
  neutral: "bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]",
  accent: "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]",
  success: "bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)]",
  warn: "bg-[var(--w-status-cautionary-soft)] text-[var(--w-status-cautionary)] border-[var(--w-status-cautionary-line)]",
  neg: "bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)]",
  violet: "bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)]",
  inverse: "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)]",
};

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
    <span
      className={cn(
        BADGE_BASE,
        BADGE_VARIANT[kind],
        size === "sm" && "px-[7px] py-0.5 text-[10.5px] gap-1",
      )}
    >
      {dot && (
        <span
          className={cn(
            "relative rounded-full shrink-0",
            size === "sm" ? "w-[5px] h-[5px]" : "w-1.5 h-1.5",
            live ? "bg-[var(--w-status-positive)]" : "bg-current",
          )}
        >
          {live && (
            <span className="absolute inset-[-3px] rounded-full border-2 border-current opacity-35 animate-[live-pulse_1.6s_ease-out_infinite]" />
          )}
        </span>
      )}
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
  const d = pts
    .map(
      (p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1),
    )
    .join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ height }}
    >
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    <div className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl py-5 px-[22px] flex flex-col gap-3 min-h-[124px]">
      <span className="font-semibold text-[12.5px] leading-none tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5">
        {label}
      </span>
      <div className="flex items-baseline gap-2.5">
        <span className="font-bold text-[30px] leading-[1.05] tracking-[-0.024em] text-[var(--w-fg-strong)]">
          {value}
          {suffix && (
            <span className="font-semibold text-base leading-none text-[var(--w-fg-neutral)] ml-1">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        {delta && (
          <span
            className={cn(
              "font-semibold text-xs leading-none inline-flex items-center gap-1",
              down ? "text-[var(--w-status-negative)]" : "text-[var(--w-status-positive)]",
            )}
          >
            <Icon name={down ? "trend-down" : "trend-up"} size={14} /> {delta}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <Sparkline data={trend} color={color} fill />
      </div>
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
    <Card className="text-center py-12 px-8 flex flex-col items-center gap-3">
      {icon && (
        <div className="w-14 h-14 rounded-full bg-[var(--w-bg-alternative)] grid place-items-center text-[var(--w-fg-neutral)]">
          {icon}
        </div>
      )}
      <div className="font-bold text-[17px] leading-[1.3] tracking-[-0.01em] text-[var(--w-fg-strong)]">
        {title}
      </div>
      {desc && (
        <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] max-w-[360px]">
          {desc}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
