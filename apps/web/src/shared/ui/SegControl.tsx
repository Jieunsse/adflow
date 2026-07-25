import { cn } from "@shared/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
}

export function SegControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
            value === opt.value
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
              : "bg-transparent text-[var(--w-fg-neutral)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
