"use client";

import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import type { BrandProfileEntry } from "../model/useBrandProfileStorage";

interface Props {
  profiles: BrandProfileEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function BrandProfilePickerModal({ profiles, activeId, onSelect, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 440 }} className="flex flex-col p-6 gap-4">
        <div className="flex items-center justify-between">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.014em] text-[var(--w-fg-strong)]">
            브랜드 프로필 선택
          </DialogTitle>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {profiles.map((profile) => {
            const isActive = activeId === profile.id || (!activeId && profile.isDefault);
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => { onSelect(profile.id); onClose(); }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border transition-[background,border-color] duration-[120ms] cursor-pointer",
                  isActive
                    ? "bg-[var(--w-primary-normal)] border-[var(--w-primary-normal)]"
                    : "bg-[var(--w-bg-normal)] border-[var(--w-line-normal)] hover:border-[var(--w-fg-strong)]"
                )}
              >
                <div className={cn(
                  "font-semibold text-[14px] leading-[1.3]",
                  isActive ? "text-white" : "text-[var(--w-fg-strong)]"
                )}>
                  {profile.name}
                </div>
                {profile.brandDescription && (
                  <div className={cn(
                    "font-medium text-[12px] leading-[1.5] mt-0.5 line-clamp-2",
                    isActive ? "text-white/80" : "text-[var(--w-fg-neutral)]"
                  )}>
                    {profile.brandDescription}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <a
          href="/brand-profile/new"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-[var(--w-line-normal)] font-medium text-[13px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] hover:border-[var(--w-fg-strong)] transition-colors duration-[120ms] no-underline"
        >
          <Icon name="plus" size={14} />
          새 프로필 추가
        </a>
      </DialogContent>
    </Dialog>
  );
}
