"use client";

// ADR-040 — 생성 설정 카드 "어떻게 만들까요?". 방식 2택(라디오 카드)이 주인공.
// 선택된 카드 안에 종속 슬롯이 펼쳐짐(productSlot/docSlot=AiImageBlock 이 주입). 생성 CTA 는 이 카드 밖.

import type { ReactNode } from "react";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

type AiImageMode = "concept" | "brief";

function RadioCard({
  on,
  label,
  desc,
  recommended,
  slot,
  onSelect,
}: {
  on: boolean;
  label: string;
  desc: string;
  recommended?: boolean;
  slot: ReactNode;
  onSelect: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "rounded-[14px] border-[1.5px] bg-[var(--w-bg-elevated)] cursor-pointer transition-[border-color,background,box-shadow] duration-[140ms]",
        on
          ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] shadow-[var(--w-shadow-emphasize)]"
          : "border-[var(--w-line-normal)] hover:border-[var(--w-line-strong)]",
      )}
    >
      <div className="flex items-start gap-3 px-4 py-[15px]">
        <span
          aria-hidden="true"
          className={cn(
            "relative flex-none w-5 h-5 mt-px rounded-full border-[1.5px] bg-[var(--w-bg-elevated)]",
            on ? "border-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)]",
          )}
        >
          {on && <span className="absolute inset-1 rounded-full bg-[var(--w-primary-normal)]" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 font-semibold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">
            {label}
            {recommended && (
              <span className="px-[7px] py-[3px] rounded-[5px] font-bold text-[10px] leading-none tracking-[0.03em] text-[var(--w-primary-press)] bg-[var(--w-primary-soft)]" style={{ fontFamily: "var(--w-font-mono)" }}>
                추천
              </span>
            )}
          </div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[5px]">{desc}</div>
        </div>
      </div>
      {on && slot && (
        <div className="ml-1 mr-4 mb-1 mt-[3px] pl-4 border-l-2 border-[var(--w-primary-normal)]">{slot}</div>
      )}
    </div>
  );
}

export default function GenSetupCard({
  mode,
  onModeChange,
  productSlot,
  docSlot,
}: {
  mode: AiImageMode;
  onModeChange: (m: AiImageMode) => void;
  productSlot: ReactNode;
  docSlot: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-8 py-[30px] flex flex-col gap-[18px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(68% 120% at 93% -18%, var(--w-accent-violet-soft), transparent 55%), radial-gradient(58% 115% at 2% 118%, var(--w-primary-soft), transparent 55%)" }}
      />
      <div className="relative z-[1] flex flex-col">
        <span className="inline-flex items-center gap-[7px] whitespace-nowrap font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-accent-violet)]">
          <Icon name="sparkles" size={13} /> AI 이미지 생성
        </span>
        <h2 className="font-extrabold text-[26px] leading-[1.3] tracking-[-0.024em] text-[var(--w-fg-strong)] mt-3 text-balance">어떻게 만들까요?</h2>
        <p className="font-medium text-[14px] leading-[1.6] text-[var(--w-fg-neutral)] mt-[9px]">선택한 카피와 제품을 바탕으로 서로 다른 컷을 만들어요.</p>
      </div>

      <div className="relative z-[1] flex flex-col gap-3">
        <RadioCard
          on={mode === "concept"}
          label="카피 기반 3컨셉"
          desc="선택한 카피에서 서로 다른 3개의 씬을 자동으로 만들어요."
          recommended
          slot={productSlot}
          onSelect={() => onModeChange("concept")}
        />
        <RadioCard
          on={mode === "brief"}
          label="기획안·자료로 생성"
          desc="제품 사진이 없을 때, 기획 문서나 참고 자료를 올려 이미지를 만들어요."
          slot={docSlot}
          onSelect={() => onModeChange("brief")}
        />
      </div>

      <div className="relative z-[1] flex items-center justify-between gap-4 pt-4 border-t border-[var(--w-line-neutral)]">
        <span className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-alternative)]">정사각형 1:1 · 3컷</span>
      </div>
    </div>
  );
}
