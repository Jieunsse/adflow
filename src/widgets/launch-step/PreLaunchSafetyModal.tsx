"use client";

// PRD-objective-aware-launch §5.1 — 게재 직전 차단 모달.
// block 이슈가 있으면 진행 불가 + 각 이슈마다 fix 액션 버튼.
// warn 만 있으면 사용자 확인 체크박스 → 진행 가능.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import type { ValidationIssue } from "@features/launch-validation";

type Props = {
  issues: ValidationIssue[];
  onClose: () => void;
  onConfirm: () => void;
};

export default function PreLaunchSafetyModal({ issues, onClose, onConfirm }: Props) {
  const blockers = issues.filter((i) => i.severity === "block");
  const warnings = issues.filter((i) => i.severity === "warn");
  const hasBlock = blockers.length > 0;
  const [acknowledged, setAcknowledged] = useState(false);
  const canProceed = !hasBlock && (warnings.length === 0 || acknowledged);

  const handleAction = (issue: ValidationIssue) => {
    if (!issue.action) return;
    if (issue.action.href) {
      const href = issue.action.href;
      if (href.startsWith("http://") || href.startsWith("https://")) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = href;
      }
      return;
    }
    if (issue.action.scrollTo) {
      onClose();
      setTimeout(() => {
        const id = issue.action!.scrollTo!.replace(/^#/, "");
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 520 }} className="flex flex-col p-0">
        <DialogTitle className="sr-only">게재 전 안전 확인</DialogTitle>
        <div className="p-[26px_26px_12px]">
          <div
            className={cn(
              "w-11 h-11 rounded-xl grid place-items-center mb-3.5",
              hasBlock
                ? "bg-[rgba(255,66,66,0.10)] text-[var(--w-status-negative)]"
                : "bg-[rgba(255,176,32,0.12)] text-[var(--w-status-cautionary)]"
            )}
          >
            <Icon name="warn" size={20} />
          </div>
          <h3 className="font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)] m-0">
            {hasBlock ? "광고 게재 전에 해결할 게 있어요" : "광고 게재 전에 확인해주세요"}
          </h3>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-2 mb-0">
            {hasBlock
              ? "아래 항목을 해결해야 광고가 정상적으로 노출돼요."
              : "아래 항목을 확인한 뒤 광고를 게재할 수 있어요."}
          </p>
        </div>

        <div className="px-[26px] pb-4 pt-2 overflow-y-auto flex-1 flex flex-col gap-3">
          {blockers.map((issue) => (
            <IssueCard key={issue.rule} issue={issue} onAction={handleAction} />
          ))}
          {warnings.map((issue) => (
            <IssueCard key={issue.rule} issue={issue} onAction={handleAction} />
          ))}

          {!hasBlock && warnings.length > 0 && (
            <label className="flex items-start gap-2.5 mt-1">
              <input
                type="checkbox"
                className="mt-[3px]"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-strong)]">
                위 항목을 확인했어요. 그대로 광고를 게재할게요.
              </span>
            </label>
          )}
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
          <Button variant="ghost" type="button" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!canProceed}
            onClick={onConfirm}
          >
            <Icon name="megaphone" size={14} /> 광고 게재 진행
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IssueCard({ issue, onAction }: { issue: ValidationIssue; onAction: (i: ValidationIssue) => void }) {
  const isBlock = issue.severity === "block";
  return (
    <div className={cn(
      "flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border",
      isBlock
        ? "bg-[rgba(255,66,66,0.08)] border-[rgba(255,66,66,0.20)] text-[var(--w-status-negative)]"
        : "bg-[rgba(255,146,0,0.10)] border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]"
    )}>
      <Icon name={isBlock ? "warn" : "info"} size={16} />
      <div className="flex-1">
        <div className="font-semibold text-[13.5px] leading-[1.4] text-[var(--w-fg-strong)] mb-1">
          {issue.title}
        </div>
        <div className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-normal)]">
          {issue.message}
        </div>
        {issue.action && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="mt-2"
            onClick={() => onAction(issue)}
          >
            {issue.action.label} <Icon name="arrow-right" size={12} />
          </Button>
        )}
      </div>
    </div>
  );
}
