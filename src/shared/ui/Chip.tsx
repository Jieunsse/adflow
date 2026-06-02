import { type HTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export type ChipVariant =
  | "live"
  | "paused"
  | "review"
  | "ended"
  | "issue"
  | "neutral"
  | "obj-traffic"
  | "obj-conversion"
  | "obj-awareness"
  | "obj-leads"
  | "obj-engagement"
  | "obj-install";

const BASE =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs leading-none tracking-[0.006em] whitespace-nowrap";

const VARIANT: Record<ChipVariant, string> = {
  live: "bg-[var(--w-green-100)] text-[var(--w-green-800)] dark:bg-[rgba(0,191,64,0.14)] dark:text-[var(--w-green-400)]",
  paused:
    "bg-[var(--w-yellow-100)] text-[var(--w-yellow-800)] dark:bg-[rgba(255,146,0,0.16)] dark:text-[#ffb24d]",
  review:
    "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] dark:text-[#6ea7ff]",
  ended:
    "bg-[rgba(112,115,124,0.10)] text-[var(--w-fg-neutral)] dark:bg-[rgba(255,255,255,0.08)]",
  issue:
    "bg-[var(--w-red-100)] text-[var(--w-red-800)] dark:bg-[rgba(255,66,66,0.16)] dark:text-[#ff7a7a]",
  neutral:
    "bg-[rgba(112,115,124,0.08)] text-[var(--w-fg-strong)] dark:bg-[rgba(255,255,255,0.06)]",
  "obj-traffic":
    "bg-[rgba(0,102,255,0.10)] text-[var(--w-primary-press)] dark:bg-[rgba(0,102,255,0.20)] dark:text-[#6ea7ff]",
  "obj-conversion":
    "bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]",
  "obj-awareness":
    "bg-[rgba(0,189,222,0.14)] text-[#0095b0] dark:bg-[rgba(0,189,222,0.22)] dark:text-[#5dd5e8]",
  "obj-leads":
    "bg-[rgba(255,146,0,0.14)] text-[var(--w-yellow-800)] dark:bg-[var(--w-status-cautionary-soft)] dark:text-[#ffb74d]",
  "obj-engagement":
    "bg-[var(--w-status-positive-soft)] text-[var(--w-green-800)] dark:bg-[rgba(0,191,64,0.18)] dark:text-[var(--w-green-400)]",
  "obj-install":
    "bg-[rgba(217,75,167,0.14)] text-[#c2185b] dark:bg-[rgba(217,75,167,0.22)] dark:text-[#ff7fbf]",
};

const DOT_COLOR: Partial<Record<ChipVariant, string>> = {
  live: "bg-[var(--w-status-positive)] dark:bg-[var(--w-green-400)]",
  paused: "bg-[var(--w-status-cautionary)] dark:bg-[#ffb24d]",
  review: "bg-[var(--w-status-info)] dark:bg-[#6ea7ff]",
  ended: "bg-[var(--w-fg-alternative)]",
  issue: "bg-[var(--w-status-negative)] dark:bg-[#ff7a7a]",
};

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant: ChipVariant;
  dot?: boolean;
}

export function Chip({
  variant,
  dot,
  className,
  children,
  ...props
}: ChipProps) {
  const isLive = variant === "live";
  return (
    <span className={cn(BASE, VARIANT[variant], className)} {...props}>
      {dot && (
        <span
          className={cn(
            "relative w-1.5 h-1.5 rounded-full shrink-0",
            DOT_COLOR[variant],
          )}
        >
          {isLive && (
            <span className="absolute inset-[-3px] rounded-full border-2 border-current opacity-35 animate-[live-pulse_1.6s_ease-out_infinite]" />
          )}
        </span>
      )}
      {children}
    </span>
  );
}
