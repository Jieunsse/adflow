import { type HTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-page-container min-h-screen lg:min-h-[calc(100vh-48px)] w-full max-w-[1600px] mx-auto rounded-none lg:rounded-[var(--w-radius-16)] border-0 lg:border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]",
        className,
      )}
      {...props}
    />
  );
}
