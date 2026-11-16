"use client";

// 작업 시간 빠른 기록 (기능명세 15-1). 단계 → 시간 순서로 눌러 끝낸다. 브랜드는 지금 고른 브랜드가 기본이다.
// 기록을 귀찮아하면 숫자가 남지 않으니 세 번 누르면 끝나야 한다.

import { useState } from "react";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { QUICK_MINUTES, TIME_STAGES, hours, timeApi } from "@entities/time-entry/model";

export default function TimeLogButton() {
  const { data: session } = useSession();
  const { profiles, activeId } = useBrandProfileStorage();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const brand = brandId ?? activeId;

  if (!session || session.browseMode || session.role === "고객") return null;

  const save = async (minutes: number) => {
    try {
      await timeApi("", "POST", { brandProfileId: brand, stage, minutes });
      showToast(`${hours(minutes)} 기록했어요`);
      setOpen(false);
      setStage(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "작업 시간을 저장하지 못했어요.");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="작업 시간 기록하기"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 grid place-items-center rounded-lg text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-alternative)]"
      >
        <Icon name="clock" size={16} />
      </button>
      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-[280px] p-3 rounded-xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] shadow-[var(--w-shadow-emphasize)] flex flex-col gap-2.5">
          <label className="flex flex-col gap-1 font-semibold text-[12px] text-[var(--w-fg-neutral)]">
            브랜드
            <select
              value={brand ?? ""}
              onChange={(e) => setBrandId(e.target.value)}
              className="rounded-lg border border-[var(--w-line-normal)] p-2 text-[13px] font-medium text-[var(--w-fg-strong)]"
            >
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name ?? "이름 없는 브랜드"}</option>)}
            </select>
          </label>
          <div className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">무엇을 했나요</div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={stage === s.key}
                onClick={() => setStage(s.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border ${stage === s.key ? "border-[var(--w-primary-normal)] text-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)] text-[var(--w-fg-strong)]"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {stage && (
            <>
              <div className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">얼마나 했나요</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!brand}
                    onClick={() => save(m)}
                    className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-alternative)]"
                  >
                    {hours(m)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
