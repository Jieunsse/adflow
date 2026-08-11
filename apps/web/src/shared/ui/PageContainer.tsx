import { type HTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-page-container min-h-[calc(100vh-48px)] w-full max-w-[1600px] mx-auto rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]",
        className,
      )}
      {...props}
    />
  );
}
