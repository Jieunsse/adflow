import Icon from "@shared/ui/Icon";

export function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onChange(); }}
      aria-checked={checked}
      role="checkbox"
      className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] grid place-items-center cursor-pointer p-0 ${checked ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]"}`}
    >
      {checked && <Icon name="check" size={11} strokeWidth={3} />}
    </button>
  );
}
