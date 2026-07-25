import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export type CardVariant = "default" | "lg" | "quiet";

const VARIANT: Record<CardVariant, string> = {
  default:
    "bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl py-[22px] px-6 dark:shadow-[var(--w-shadow-card)]",
  lg: "bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[20px] py-7 px-[30px] dark:shadow-[var(--w-shadow-card)]",
  quiet:
    "bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-xl py-[22px] px-6",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <div ref={ref} className={cn(VARIANT[variant], className)} {...props} />
  ),
);
Card.displayName = "Card";
