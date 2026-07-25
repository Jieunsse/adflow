import Link from "next/link";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

interface Props {
  label: string;
  hint: string;
  href?: string;
}

const BASE =
  "flex flex-col items-center justify-center gap-2 text-center min-h-[120px] p-5 rounded-xl border border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] transition-colors";

export default function EmptyCard({ label, hint, href }: Props) {
  const inner = (
    <>
      <span className="grid place-items-center w-[30px] h-[30px] rounded-full bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)]">
        <Icon name="plus" size={15} />
      </span>
      <span className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">{label}</span>
      <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)]">{hint}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(BASE, "no-underline hover:border-[var(--w-fg-normal)] hover:bg-[var(--w-bg-alternative)]")}>
        {inner}
      </Link>
    );
  }
  return <div className={BASE}>{inner}</div>;
}
