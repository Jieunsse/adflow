"use client";

import { useEffect, useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@shared/ui/Dialog";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3.5 py-3 font-medium text-[14px] leading-[1.6] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)] transition-[border-color,box-shadow] duration-[120ms] resize-y";

export function OutreachDraftModal({
  creatorHandle,
  initialDraft,
  loading,
  error,
  onClose,
  onGenerate,
  onSave,
}: {
  creatorHandle: string;
  initialDraft: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onGenerate: () => void;
  onSave: (draft: string) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 560 }}>
        <div className="px-6 pt-6 pb-2">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">
            협업 제안 메시지 초안이에요
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              {creatorHandle} 에게 보낼 초안이에요. AdFlow 가 대신 보내진 않아요. 복사해서 크리에이터에게 직접 전해 주세요.
            </div>
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-3 px-6 py-4">
          {error && (
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-status-negative)]">{error}</div>
          )}
          <textarea
            className={TEXTAREA_CLASS}
            style={{ minHeight: 220 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={loading ? "생성 중이에요..." : "초안을 생성해 주세요"}
            disabled={loading}
          />
          <Button variant="secondary" size="sm" type="button" onClick={onGenerate} disabled={loading}>
            <Icon name="refresh" size={14} spin={loading} /> {draft ? "다시 생성" : "초안 생성"}
          </Button>
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)]">
          <Button variant="ghost" type="button" onClick={onClose}>
            닫기
          </Button>
          <Button variant="secondary" type="button" onClick={handleCopy} disabled={!draft}>
            <Icon name="copy" size={15} /> 복사
          </Button>
          <Button variant="primary" type="button" onClick={() => onSave(draft)} disabled={!draft}>
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
