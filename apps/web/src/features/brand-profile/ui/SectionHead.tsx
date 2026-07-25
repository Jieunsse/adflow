interface Props {
  index: string;
  title: string;
  desc?: string;
  count?: number;
}

export default function SectionHead({ index, title, desc, count }: Props) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="grid place-items-center w-[30px] h-[30px] rounded-lg bg-[var(--w-bg-neutral)] font-bold text-[12px] leading-none text-[var(--w-fg-neutral)] shrink-0">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="m-0 font-bold text-[20px] leading-[1.3] tracking-[-0.018em] text-[var(--w-fg-strong)]">
            {title}
          </h2>
          {count != null && (
            <span className="inline-flex items-center px-[9px] py-[3px] rounded-full bg-[var(--w-bg-alternative)] font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">
              {count}
            </span>
          )}
        </div>
        {desc && (
          <p className="m-0 mt-1 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
            {desc}
          </p>
        )}
      </div>
    </div>
  );
}
