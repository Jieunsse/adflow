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
  threshold,
  thresholdColor = "var(--w-status-negative)",
}: {
  data: number[] | null | undefined;
  color?: string;
  fill?: boolean;
  height?: number;
  /** 기준선(손익분기 등). 값 범위에 포함시켜 그리므로 선 밖에 있어도 잘리지 않는다. */
  threshold?: number;
  thresholdColor?: string;
}) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = height;
  const domain = threshold != null ? [...data, threshold] : data;
  const min = Math.min(...domain);
  const max = Math.max(...domain);
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
      {threshold != null && (
        <line
          x1="0"
          x2={w}
          y1={h - ((threshold - min) / range) * (h - 4) - 2}
          y2={h - ((threshold - min) / range) * (h - 4) - 2}
          stroke={thresholdColor}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── MiniBars — 근거 지표 레일의 막대 스파크라인. 최대값 막대만 진하게. ── */

export function MiniBars({
  data,
  color = "var(--w-primary-normal)",
  mutedColor = "rgba(0,102,255,0.3)",
  height = 34,
}: {
  data: number[] | null | undefined;
  color?: string;
  mutedColor?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const w = 120;
  const gap = 5;
  const barW = (w - gap * (data.length - 1)) / data.length;
  const max = Math.max(...data) || 1;
  const peak = data.indexOf(max);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: w, height }} aria-hidden>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - barH}
            width={barW}
            height={barH}
            rx="2"
            fill={i === peak ? color : mutedColor}
          />
        );
      })}
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
