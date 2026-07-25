"use client";

import { Button } from "@shared/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@shared/ui/Dialog";

export function SettleConfirmModal({
  creatorHandle,
  onClose,
  onInputPerformance,
  onSkip,
}: {
  creatorHandle: string;
  onClose: () => void;
  onInputPerformance: () => void;
  onSkip: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 440 }}>
        <div className="px-6 pt-6 pb-2">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">
            정산 전에 성과를 입력할까요?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              {creatorHandle} — 지급 완료로 표시할게요. 실제 지급은 AdFlow 밖에서 진행해요. 성과를 입력하지 않으면 다음 캠페인 랭킹에 반영되지 않아요.
            </div>
          </DialogDescription>
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)]">
          <Button variant="ghost" type="button" onClick={onSkip}>
            성과 없이 정산
          </Button>
          <Button variant="primary" type="button" onClick={onInputPerformance}>
            성과 입력하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
