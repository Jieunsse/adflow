"use client";

import { cn } from "@shared/lib/cn";
import Icon from "@shared/ui/Icon";
import { useLaunchDraft } from "@entities/campaign/model";

const MODES = [
  {
    id: "simple" as const,
    icon: "sparkles" as const,
    label: "간단 설정",
    badge: "추천",
    desc: "최소 입력으로 빠르게 집행해요.",
    bullets: ["캠페인 목표: 트래픽 자동 고정", "어드밴티지+ 타겟 · 노출 위치", "자동 입찰 (최저 비용)"],
  },
  {
    id: "detailed" as const,
    icon: "settings" as const,
    label: "디테일 설정",
    badge: null,
    desc: "목표·타겟·입찰을 직접 설정해요.",
    bullets: ["캠페인 목표 직접 선택", "맞춤·유사 타겟", "입찰 전략·금액 설정"],
  },
];

export default function ModeToggle() {
  const { state, dispatch } = useLaunchDraft();

  const handleSwitch = (target: "simple" | "detailed") => {
    if (target === state.mode) return;
    dispatch({ type: "SET_MODE", mode: target });
  };

  return (
    <div className="flex gap-2.5 mb-4">
      {MODES.map((m) => {
        const selected = state.mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => handleSwitch(m.id)}
            className={cn(
              "flex-1 flex flex-col items-start gap-0 p-[16px_18px] rounded-[var(--w-radius-16)] cursor-pointer text-left transition-[border-color,background] duration-[150ms]",
              selected
                ? "border-2 border-[var(--w-accent-violet)] bg-[var(--w-accent-violet-soft)] shadow-none"
                : "border-2 border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] shadow-[var(--w-shadow-card)]"
            )}
            aria-pressed={selected}
          >
            <div className="flex items-center gap-2.5 w-full mb-2.5">
              <span className={cn(
                "inline-flex items-center justify-center w-[34px] h-[34px] rounded-[var(--w-radius-8)] shrink-0",
                selected ? "bg-[rgba(101,65,242,0.14)]" : "bg-[var(--w-bg-alternative)]"
              )}>
                <Icon name={m.icon} size={16} style={{ color: selected ? "var(--w-accent-violet)" : "var(--w-fg-neutral)" }} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "font-bold text-[15px] leading-[1.25] tracking-[var(--w-tracking-heading)]",
                    selected ? "text-[var(--w-accent-violet)]" : "text-[var(--w-fg-strong)]"
                  )}>
                    {m.label}
                  </span>
                  {m.badge && (
                    <span className="bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] text-[10px] font-semibold px-[7px] py-[2px] rounded-[var(--w-radius-pill)] tracking-[0.02em]">
                      {m.badge}
                    </span>
                  )}
                </div>
              </div>

              <span className={cn(
                "w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0 transition-[border-color,background] duration-[150ms]",
                selected
                  ? "border-2 border-[var(--w-accent-violet)] bg-[var(--w-accent-violet)]"
                  : "border-2 border-[var(--w-line-normal)] bg-transparent"
              )}>
                {selected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </div>

            <p className={cn(
              "m-0 mb-2.5 font-medium text-[13px] leading-[1.5] tracking-[var(--w-tracking-body)]",
              selected ? "text-[var(--w-fg-neutral)]" : "text-[var(--w-fg-normal)]"
            )}>
              {m.desc}
            </p>

            <div className={cn(
              "w-full h-px mb-2.5",
              selected ? "bg-[rgba(101,65,242,0.15)]" : "bg-[var(--w-line-alternative)]"
            )} />

            <div className="flex flex-col gap-1.5">
              {m.bullets.map((b) => (
                <div key={b} className="flex items-center gap-[7px]">
                  <span className={cn(
                    "w-[5px] h-[5px] rounded-full shrink-0",
                    selected ? "bg-[var(--w-accent-violet)]" : "bg-[var(--w-fg-neutral)]"
                  )} />
                  <span className={cn(
                    "font-medium text-[12px] leading-[1.4] tracking-[var(--w-tracking-caption)]",
                    selected ? "text-[rgba(101,65,242,0.75)]" : "text-[var(--w-fg-normal)]"
                  )}>
                    {b}
                  </span>
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
