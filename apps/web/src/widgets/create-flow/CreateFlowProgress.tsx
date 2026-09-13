"use client";

import { cn } from "@shared/lib/cn";

const STEPS = ["브리프", "소재 선택", "게재 설정", "검토 후 게재"];

export default function CreateFlowProgress({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <nav aria-label="광고 만들기 진행" className="flex items-center gap-2 overflow-x-auto px-1">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={label} className="flex min-w-max items-center gap-2">
            {index > 0 && (
              <span className={cn("h-px w-8 sm:w-12", done ? "bg-[var(--w-primary-normal)]" : "bg-[var(--w-line-normal)]")} />
            )}
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold",
                active || done
                  ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-normal)] text-[var(--w-primary-on)]"
                  : "border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] text-[var(--w-fg-neutral)]",
              )}
            >
              {done ? "✓" : index + 1}
            </span>
            <span className={cn("text-[12px] font-semibold leading-none", active ? "text-[var(--w-primary-normal)]" : "text-[var(--w-fg-neutral)]")}>
              {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
