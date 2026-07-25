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
  | "obj-install"
  | "accent"
  | "success"
  | "warn"
  | "neg"
  | "violet";

const BASE =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs leading-none tracking-[0.006em] whitespace-nowrap";

const SIZE_SM = "gap-1 px-[7px] py-0.5 text-[11px]";

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
    "bg-transparent text-[var(--w-fg-neutral)] border border-[var(--w-line-normal)] dark:border-[rgba(255,255,255,0.14)]",
  "obj-conversion":
    "bg-transparent text-[var(--w-fg-neutral)] border border-[var(--w-line-normal)] dark:border-[rgba(255,255,255,0.14)]",
  "obj-awareness":
    "bg-transparent text-[var(--w-fg-neutral)] border border-[var(--w-line-normal)] dark:border-[rgba(255,255,255,0.14)]",
  "obj-leads":
    "bg-transparent text-[var(--w-fg-neutral)] border border-[var(--w-line-normal)] dark:border-[rgba(255,255,255,0.14)]",
  "obj-engagement":
    "bg-transparent text-[var(--w-fg-neutral)] border border-[var(--w-line-normal)] dark:border-[rgba(255,255,255,0.14)]",
  "obj-install":
    "bg-transparent text-[var(--w-fg-neutral)] border border-[var(--w-line-normal)] dark:border-[rgba(255,255,255,0.14)]",
  accent: "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]",
  success: "bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)]",
  warn: "bg-[var(--w-status-cautionary-soft)] text-[var(--w-status-cautionary)] border border-[var(--w-status-cautionary-line)]",
  neg: "bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)]",
  violet: "bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)]",
};

const DOT_COLOR: Partial<Record<ChipVariant, string>> = {
  live: "bg-[var(--w-status-positive)] dark:bg-[var(--w-green-400)]",
  paused: "bg-[var(--w-status-cautionary)] dark:bg-[#ffb24d]",
  review: "bg-[var(--w-status-info)] dark:bg-[#6ea7ff]",
  ended: "bg-[var(--w-fg-alternative)]",
  issue: "bg-[var(--w-status-negative)] dark:bg-[#ff7a7a]",
  accent: "bg-[var(--w-primary-normal)]",
  success: "bg-[var(--w-status-positive)]",
  warn: "bg-[var(--w-status-cautionary)]",
  neg: "bg-[var(--w-status-negative)]",
  violet: "bg-[var(--w-accent-violet)]",
};

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant: ChipVariant;
  dot?: boolean;
  live?: boolean;
  size?: "sm";
}

export function Chip({
  variant,
  dot,
  live,
  size,
  className,
  children,
  ...props
}: ChipProps) {
  const pulse = !!live || variant === "live";
  return (
    <span className={cn(BASE, VARIANT[variant], size === "sm" && SIZE_SM, className)} {...props}>
      {dot && (
        <span
          className={cn(
            "relative rounded-full shrink-0",
            size === "sm" ? "w-[5px] h-[5px]" : "w-1.5 h-1.5",
            DOT_COLOR[variant],
          )}
        >
          {pulse && (
            <span className="absolute inset-[-3px] rounded-full border-2 border-current opacity-35 animate-[live-pulse_1.6s_ease-out_infinite]" />
          )}
        </span>
      )}
      {children}
    </span>
  );
}
