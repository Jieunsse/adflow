import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

type IconName = Parameters<typeof Icon>[0]["name"];

interface Props {
  icon: IconName;
  label: string;
  value: number;
  accent?: string;
  onClick?: () => void;
}

export default function StatTile({ icon, label, value, accent, onClick }: Props) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span
          className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
          style={{
            background: accent ? `color-mix(in srgb, ${accent} 14%, transparent)` : "var(--w-bg-alternative)",
            color: accent ?? "var(--w-fg-neutral)",
          }}
        >
          <Icon name={icon} size={15} />
        </span>
        <span className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">{label}</span>
      </div>
      <div className="font-extrabold text-[28px] leading-none tracking-[-0.02em] text-[var(--w-fg-strong)] tabular-nums">
        {value}
      </div>
    </>
  );

  const cls = "flex flex-col gap-3 rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-5 py-[18px] dark:shadow-[var(--w-shadow-card)] text-left";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(cls, "cursor-pointer transition-colors hover:border-[var(--w-primary-normal)] focus-visible:border-[var(--w-primary-normal)] focus-visible:outline-none")}
      >
        {content}
      </button>
    );
  }

  return <div className={cls}>{content}</div>;
}
