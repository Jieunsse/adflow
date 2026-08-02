"use client";

// 시안(1c·2a·2b·1d·1e) 이 공유하는 껍데기 조각들.
// 상단 바·자동저장 pill·패널 카드·선택 칩·VER 배지는 모든 화면에서 같은 규칙으로 쓰인다.

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@shared/lib/cn";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { COPY_HOOK_MAP, type CopyHook } from "@entities/creative/options";

/** 단계 상단 고정 바 — 좌: 제목·배지·자동저장, 우: 액션 버튼들(children). */
export function StepHeaderBar({
  title,
  badge,
  savedLabel,
  children,
}: {
  title: string;
  badge?: ReactNode;
  savedLabel?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 bg-[var(--w-bg-normal)] border-b border-[var(--w-line-alternative)]">
      <span className="font-bold text-[17px] leading-[1.4] tracking-[-0.012em] text-[var(--w-fg-strong)]">
        {title}
      </span>
      {badge}
      {savedLabel && <SavePill label={savedLabel} />}
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function SavePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-[var(--w-fill-normal)] font-medium text-[12px] leading-[1.3] text-[var(--w-fg-normal)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--w-status-positive)]" />
      {label}
    </span>
  );
}

/** 시안의 흰 패널 — radius-12 + shadow-card. 단계 안의 모든 묶음이 이 표면을 쓴다. */
export function PanelCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-[var(--w-bg-normal)] rounded-[var(--w-radius-12)] shadow-[var(--w-shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

/** 브리프 카드 머리의 번호 뱃지(①②③). */
export function NumberBadge({ n }: { n: number }) {
  return (
    <span className="w-5 h-5 shrink-0 rounded-full bg-[var(--w-primary-normal)] text-[var(--w-primary-on)] font-bold text-[11px] leading-5 text-center">
      {n}
    </span>
  );
}

interface SelectChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  chipSize?: "sm" | "md";
}

/** 시안의 Chip — 선택되면 채워지고, 아니면 보더만. 목표·타겟·분위기·채널이 전부 이걸 쓴다. */
export function SelectChip({ active, chipSize = "md", className, ...props }: SelectChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium cursor-pointer whitespace-nowrap transition-[background,border-color,color] duration-[120ms]",
        chipSize === "sm" ? "px-2.5 py-[5px] text-[12px] leading-[1.3]" : "px-3.5 py-2 text-[13px] leading-[1.3]",
        active
          ? "bg-[var(--w-primary-normal)] border-[var(--w-primary-normal)] text-[var(--w-primary-on)]"
          : "bg-[var(--w-bg-normal)] border-[var(--w-line-normal)] text-[var(--w-fg-normal)] hover:bg-[var(--w-bg-neutral)]",
        className,
      )}
      {...props}
    />
  );
}

// 카피 훅 → 배지 색. 시안은 트렌드=파랑 · 스토리=보라 · 반전=주황.
const HOOK_CHIP_VARIANT: Record<CopyHook, ChipVariant> = {
  benefit: "accent",
  trust: "success",
  number: "accent",
  rush: "warn",
  unique: "violet",
  trendy: "accent",
  story: "violet",
  surprise: "warn",
};

/** `VER 01` 모노 라벨 + 훅 배지 한 쌍. */
export function VerLabel({ index, hook }: { index: number; hook?: CopyHook | null }) {
  return (
    <>
      <span className="font-semibold text-[11px] leading-[1.3] font-[var(--w-font-mono)] text-[var(--w-fg-alternative)]">
        VER {String(index + 1).padStart(2, "0")}
      </span>
      {hook && (
        <Chip variant={HOOK_CHIP_VARIANT[hook]} size="sm">
          {COPY_HOOK_MAP[hook].ko}
        </Chip>
      )}
    </>
  );
}

/** 시안의 링 — 선택된 안은 primary 2px + emphasize, 아니면 얇은 보더 + card. */
export function selectionRing(selected: boolean): string {
  return selected
    ? "0 0 0 2px var(--w-primary-normal), var(--w-shadow-emphasize)"
    : "inset 0 0 0 1px var(--w-line-neutral), var(--w-shadow-card)";
}
