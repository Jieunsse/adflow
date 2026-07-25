"use client";

// ADR-040 — 빈 상태(A) 진입 패널(히어로형). 생성 CTA 소유.
// 좌: 카피+CTA / 우: 빈 컨셉 카드 3장 프리뷰. 상태는 AiImageBlock 이 소유, props 로 받음.

import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";

export default function ImageEntryHero({
  generating,
  disabled,
  onGenerate,
  onDoc,
}: {
  generating: boolean;
  disabled: boolean;
  onGenerate: () => void;
  onDoc: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-8 py-9">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 120% at 88% -10%, var(--w-accent-violet-soft), transparent 55%), radial-gradient(70% 110% at 6% 110%, var(--w-primary-soft), transparent 55%)" }}
      />
      <div className="relative z-[1] grid items-center gap-10" style={{ gridTemplateColumns: "1.05fr 0.95fr" }}>
        <div>
          <span className="inline-flex items-center gap-[7px] whitespace-nowrap font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-accent-violet)]">
            <Icon name="sparkles" size={13} /> 3컷 컨셉 제안
          </span>
          <h3 className="font-extrabold text-[30px] leading-[1.28] tracking-[-0.026em] text-[var(--w-fg-strong)] mt-3.5 text-balance">
            카피에 어울리는 이미지,<br />AI가 3가지 컨셉으로 만들어 드려요
          </h3>
          <p className="font-medium text-[15px] leading-[1.65] text-[var(--w-fg-neutral)] mt-3 max-w-[440px]">
            서로 다른 분위기의 3컷을 한 번에 제안해 드려요. 마음에 드는 <b className="font-bold text-[var(--w-fg-strong)]">딱 1장</b>만 고르면 바로 광고에 쓸 수 있어요.
          </p>
          <div className="flex flex-wrap gap-[18px] mt-[22px] mb-[26px]">
            <span className="flex items-center gap-2 font-medium text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">
              <span className="grid place-items-center text-[var(--w-primary-press)]"><Icon name="grid" size={15} /></span> 3컷 동시 생성
            </span>
            <span className="flex items-center gap-2 font-medium text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">
              <span className="grid place-items-center text-[var(--w-primary-press)]"><Icon name="refresh" size={15} /></span> 약 15초 소요
            </span>
            <span className="flex items-center gap-2 font-medium text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">
              <span className="grid place-items-center text-[var(--w-primary-press)]"><Icon name="image" size={15} /></span> 제품 원본 유지
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" type="button" disabled={generating || disabled} onClick={onGenerate}>
              <Icon name="sparkles" size={16} /> {generating ? "컨셉 제안 중…" : "AI 컨셉으로 3컷 만들기"}
            </Button>
            <Button variant="ghost" type="button" onClick={onDoc} className="border border-[var(--w-line-normal)]">
              <Icon name="doc" size={15} /> 기획안·자료로 만들기
            </Button>
          </div>
        </div>

        <div aria-hidden="true" className="relative h-[248px]">
          {[1, 2, 3].map((n) => {
            const pos =
              n === 1
                ? { left: "4%", top: 34, transform: "rotate(-8deg)", zIndex: 1, width: 150 }
                : n === 2
                  ? { left: "32%", top: 8, transform: "rotate(1deg)", zIndex: 3, width: 168 }
                  : { left: "62%", top: 40, transform: "rotate(9deg)", zIndex: 2, width: 150 };
            return (
              <div
                key={n}
                className="absolute grid place-items-center overflow-hidden rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] text-[var(--w-fg-assistive)] shadow-[var(--w-shadow-strong)]"
                style={{ aspectRatio: "1 / 1", ...pos }}
              >
                <span className="absolute top-2 left-2 grid place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[11px] leading-none text-[var(--w-fg-neutral)]" style={{ fontFamily: "var(--w-font-mono)" }}>
                  {n}
                </span>
                <Icon name="image" size={26} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
