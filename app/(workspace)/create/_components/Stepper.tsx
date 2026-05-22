import { Fragment } from "react";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

const STEPS = [
  { label: "01", title: "소재 만들기" },
  { label: "02", title: "광고 집행" },
  { label: "03", title: "마무리 점검" },
];

export default function Stepper({
  step,
  setStep,
  completed,
  stepValid,
}: {
  step: number;
  setStep: (n: number) => void;
  completed: boolean[];
  stepValid: boolean[];
}) {
  return (
    <div className="flex items-center gap-2 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[14px] p-2.5">
      {STEPS.map((s, i) => {
        const on = step === i;
        const done = !!completed[i] && !on;
        const reachable = i === 0 || !!stepValid[i - 1];
        return (
          <Fragment key={s.label}>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-[10px] cursor-pointer border-none text-left flex-1 min-w-0 transition-[background] duration-[120ms]",
                on ? "bg-[var(--w-primary-normal)]" : "bg-transparent hover:bg-[var(--w-bg-neutral)]"
              )}
              onClick={() => reachable && setStep(i)}
              disabled={!reachable}
              style={{ opacity: reachable ? 1 : 0.5 }}
            >
              <div className={cn(
                "w-[26px] h-[26px] rounded-full grid place-items-center border-[1.5px] font-bold text-[12px] leading-none [font-family:var(--w-font-mono)] flex-none",
                done
                  ? "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] border-transparent"
                  : on
                    ? "bg-white text-[var(--w-fg-strong)] border-transparent"
                    : "border-[var(--w-line-normal)] text-[var(--w-fg-neutral)]"
              )}>
                {done ? <Icon name="check" size={14} /> : s.label}
              </div>
              <div className="min-w-0">
                <div className={cn(
                  "font-medium text-[10.5px] leading-none tracking-[0.04em] uppercase",
                  on ? "text-[rgba(255,255,255,0.6)]" : "text-[var(--w-fg-neutral)]"
                )}>
                  STEP {s.label}
                </div>
                <div className={cn(
                  "font-semibold text-[13.5px] leading-[1.2] tracking-[-0.006em] mt-1",
                  on ? "text-white" : "text-[var(--w-fg-strong)]"
                )}>
                  {s.title}
                </div>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <div className="text-[var(--w-fg-neutral)]"><Icon name="arrow-right" size={14} /></div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
