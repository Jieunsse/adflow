import type { ReactNode } from "react";
import Icon from "./Icon";
import { cn } from "@shared/lib/cn";
import { Card } from "./Card";

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
      <span className="font-semibold text-[13px] leading-none tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5">
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
