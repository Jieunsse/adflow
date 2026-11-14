import type { ReactNode } from "react";

export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">{label}</label>
      {hint && <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">{hint}</p>}
      {children}
    </div>
  );
}
