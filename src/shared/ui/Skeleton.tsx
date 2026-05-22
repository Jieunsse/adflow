import { type HTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-[linear-gradient(90deg,var(--w-bg-neutral)_0%,var(--w-bg-alternative)_50%,var(--w-bg-neutral)_100%)] [background-size:200%_100%] animate-[skel_1.4s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  );
}
