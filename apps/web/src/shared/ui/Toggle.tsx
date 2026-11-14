export function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`relative w-10 h-6 rounded-full border-0 cursor-pointer shrink-0 transition-colors duration-150 ${on ? "bg-[var(--w-primary-normal)]" : "bg-[var(--w-fg-assistive)]"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[var(--w-shadow-emphasize)] transition-[left] duration-150 ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
