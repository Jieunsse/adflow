import type { ReactNode } from "react";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

type IconName = Parameters<typeof Icon>[0]["name"];

interface Props {
  title: string;
  icon?: IconName;
  count?: number;
  desc?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  nested?: boolean;
  children: ReactNode;
}

export default function Panel({ title, icon, count, desc, action, className, bodyClassName, nested, children }: Props) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border p-5",
        nested
          ? "border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]"
          : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] dark:shadow-[var(--w-shadow-card)]",
        className,
      )}
    >
      <div className="flex items-start gap-2.5 mb-4">
        {icon && (
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] shrink-0">
            <Icon name={icon} size={15} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="m-0 font-bold text-[15px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
              {title}
            </h2>
            {count != null && (
              <span className="inline-flex items-center px-[8px] py-[2px] rounded-full bg-[var(--w-bg-alternative)] font-semibold text-[11px] leading-none text-[var(--w-fg-neutral)]">
                {count}
              </span>
            )}
          </div>
          {desc && (
            <p className="m-0 mt-0.5 font-medium text-[12px] leading-[1.45] text-[var(--w-fg-alternative)]">
              {desc}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
