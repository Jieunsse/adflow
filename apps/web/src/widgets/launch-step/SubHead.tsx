export default function SubHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="font-semibold text-[14px] leading-[1.3] tracking-[-0.004em] text-[var(--w-fg-strong)]">
        {title}
      </div>
      {subtitle && (
        <div className="font-normal text-[13px] leading-[1.45] text-[var(--w-fg-neutral)] mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
}
