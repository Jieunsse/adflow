"use client";

import { useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { Select } from "@shared/ui/Select";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@shared/ui/Dialog";
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 420 }}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <DialogTitle className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.014em] text-[var(--w-fg-strong)]">
              새 페르소나
            </DialogTitle>
            <DialogClose className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
              <Icon name="x" size={18} />
            </DialogClose>
          </div>

          <div className="flex flex-col gap-4">
            {needsProfileSelect && (
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">
                  브랜드 프로필 <span className="text-red-500">*</span>
                </label>
                {profiles.length === 0 ? (
                  <p className="font-medium text-[13px] text-[var(--w-fg-neutral)]">
                    브랜드 프로필이 없어요.{" "}
                    <a href="/brand-profile" className="text-[var(--w-primary-normal)] hover:underline">만들러 가기 →</a>
                  </p>
                ) : (
                  <Select
                    value={selectedProfileId}
                    onChange={setSelectedProfileId}
                    options={profiles.map((bp) => ({ value: bp.id, label: bp.name }))}
                    placeholder="선택해주세요"
                  />
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">
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
              <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">
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
      </DialogContent>
    </Dialog>
  );
}
