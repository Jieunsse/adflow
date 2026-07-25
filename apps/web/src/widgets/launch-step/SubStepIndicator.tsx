"use client";

interface StepDef { n: number; label: string }
interface Props { steps: StepDef[]; current: number; onStepClick: (n: number) => void }

export default function SubStepIndicator({ steps, current, onStepClick }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <button
              type="button"
              onClick={() => onStepClick(s.n)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: active || done ? "var(--w-accent-violet)" : "transparent",
                border: `2px solid ${active || done ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
                color: active || done ? "#fff" : "var(--w-fg-neutral)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                font: "700 11px/1 var(--w-font-sans)",
              }}>
                {done
                  ? <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : s.n}
              </span>
              <span style={{
                font: `${active ? "600" : "500"} 13px/1 var(--w-font-sans)`,
                color: active ? "var(--w-accent-violet)" : done ? "var(--w-fg-normal)" : "var(--w-fg-neutral)",
                whiteSpace: "nowrap",
              }}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? "var(--w-accent-violet)" : "var(--w-line-normal)", margin: "0 10px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
