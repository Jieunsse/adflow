"use client";

import { useEffect, useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import type { PersonaEntry } from "../model/usePersonasStorage";
import type { BrandProfileEntry } from "../model/useBrandProfileStorage";

const INPUT_CLS =
  "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]";

interface Props {
  activeBrandProfileId: string | null;
  profiles: BrandProfileEntry[];
  onSave: (p: PersonaEntry) => void;
  onClose: () => void;
}

export default function PersonaQuickCreateModal({ activeBrandProfileId, profiles, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [customerDescription, setCustomerDescription] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    activeBrandProfileId ?? profiles[0]?.id ?? "",
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needsProfileSelect = !activeBrandProfileId;
  const resolvedProfileId = activeBrandProfileId ?? selectedProfileId;

  const handleSave = () => {
    if (!name.trim() || !resolvedProfileId) return;
    onSave({
      id: `persona-${Date.now()}`,
      brandProfileId: resolvedProfileId,
      name: name.trim(),
      customerDescription: customerDescription.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[420px] bg-[var(--w-bg-elevated)] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.014em] text-[var(--w-fg-strong)]">
            새 페르소나
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {needsProfileSelect && (
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">
                브랜드 프로필 <span className="text-red-500">*</span>
              </label>
              {profiles.length === 0 ? (
                <p className="font-medium text-[13px] text-[var(--w-fg-neutral)]">
                  브랜드 프로필이 없어요.{" "}
                  <a href="/brand-profile" className="text-[var(--w-primary-normal)] hover:underline">만들러 가기 →</a>
                </p>
              ) : (
                <select
                  className={cn(INPUT_CLS, "cursor-pointer")}
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                >
                  <option value="">선택해주세요</option>
                  {profiles.map((bp) => (
                    <option key={bp.id} value={bp.id}>{bp.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              className={INPUT_CLS}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="예) 20대 직장여성"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">
              고객 설명 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span>
            </label>
            <textarea
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-none min-h-[72px]"
              value={customerDescription}
              onChange={(e) => setCustomerDescription(e.target.value)}
              placeholder="예) 피부 트러블에 민감한 20대 초반 여성. 성분 중심으로 구매 결정."
            />
            <p className="m-0 font-medium text-[12px] text-[var(--w-fg-neutral)]">
              연령·성별·관심사 등 세부 설정은 브랜드 프로필에서 편집할 수 있어요.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || (needsProfileSelect && !selectedProfileId)}
          >
            만들기
          </Button>
        </div>
      </div>
    </div>
  );
}
