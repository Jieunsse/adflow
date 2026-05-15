import { Fragment } from "react";
import Icon from "@shared/ui/Icon";

const STEPS = [
  { label: "01", title: "소재 만들기" },
  { label: "02", title: "광고 집행" },
  { label: "03", title: "성과 확인" },
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
    <div className="stepper">
      {STEPS.map((s, i) => {
        const on = step === i;
        const done = !!completed[i] && !on;
        const reachable = i === 0 || !!stepValid[i - 1];
        return (
          <Fragment key={s.label}>
            <button
              type="button"
              className={"stepper__step" + (on ? " stepper__step--on" : done ? " stepper__step--done" : "")}
              onClick={() => reachable && setStep(i)}
              disabled={!reachable}
              style={{ opacity: reachable ? 1 : 0.5 }}
            >
              <div className="stepper__num">{done ? <Icon name="check" size={14} /> : s.label}</div>
              <div className="stepper__meta">
                <div className="stepper__label-sm">STEP {s.label}</div>
                <div className="stepper__label">{s.title}</div>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <div className="stepper__arrow"><Icon name="arrow-right" size={14} /></div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
