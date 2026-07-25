"use client";

import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import Icon from "@shared/ui/Icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@shared/ui/Dialog";
import type { GenerateContentGuidelineResult } from "@/lib/prompts/creator-content-guideline";

export function ContentGuidelineModal({
  creatorHandle,
  guideline,
  loading,
  error,
  onClose,
  onGenerate,
}: {
  creatorHandle: string;
  guideline: GenerateContentGuidelineResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const handleCopy = () => {
    if (!guideline) return;
    const text = [
      `[꼭 담을 요소]`,
      ...guideline.mustInclude.map((m) => `- ${m}`),
      "",
      `[톤]`,
      guideline.tone,
      "",
      `[Do & Don't]`,
      ...guideline.dosDonts.map((d) => `- ${d}`),
      "",
      `[참고 캡션]`,
      guideline.caption,
    ].join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 560 }}>
        <div className="px-6 pt-6 pb-2">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">
            콘텐츠 가이드라인이에요
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              {creatorHandle} 에게 전달할 제작 가이드예요.
            </div>
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 px-6 py-4">
          {error && (
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-status-negative)]">{error}</div>
          )}

          {!guideline && !loading && !error && (
            <Button variant="secondary" size="sm" type="button" onClick={onGenerate}>
              가이드라인 생성
            </Button>
          )}

          {loading && (
            <div className="flex items-center gap-2 font-medium text-[13px] text-[var(--w-fg-neutral)]">
              <Icon name="refresh" size={14} spin /> 생성 중이에요...
            </div>
          )}

          {guideline && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)]">꼭 담을 요소</span>
                <div className="flex flex-wrap gap-1.5">
                  {guideline.mustInclude.map((m) => (
                    <Chip key={m} variant="neutral" size="sm">
                      {m}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)]">톤</span>
                <p className="m-0 font-medium text-[13.5px] leading-[1.55] text-[var(--w-fg-normal)]">
                  {guideline.tone}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)]">Do &amp; Don&apos;t</span>
                <ul className="m-0 pl-[18px] font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-normal)]">
                  {guideline.dosDonts.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)]">참고 캡션</span>
                  <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">
                    참고 샘플이에요
                  </span>
                </div>
                <p className="m-0 font-medium text-[13.5px] leading-[1.55] text-[var(--w-fg-normal)] whitespace-pre-wrap">
                  {guideline.caption}
                </p>
              </div>

              <Button variant="secondary" size="sm" type="button" onClick={onGenerate}>
                <Icon name="refresh" size={14} /> 다시 생성
              </Button>
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)]">
          <Button variant="ghost" type="button" onClick={onClose}>
            닫기
          </Button>
          <Button variant="primary" type="button" onClick={handleCopy} disabled={!guideline}>
            <Icon name="copy" size={15} /> 복사
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
