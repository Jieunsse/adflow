"use client";

// PRD-objective-aware-launch §5.1 — 게재 직전 차단 모달.
// block 이슈가 있으면 진행 불가 + 각 이슈마다 fix 액션 버튼.
// warn 만 있으면 사용자 확인 체크박스 → 진행 가능.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
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
      // 절대 URL = 외부 (Meta 비즈니스 스위트 등) → 새 탭. 상대 경로 = 같은 앱 내 페이지 → 같은 탭 이동.
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "26px 26px 12px" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: hasBlock ? "rgba(255,66,66,0.10)" : "rgba(255,176,32,0.12)",
              color: hasBlock ? "var(--w-status-negative)" : "var(--w-status-cautionary)",
              display: "grid",
              placeItems: "center",
              marginBottom: 14,
            }}
          >
            <Icon name="warn" size={20} />
          </div>
          <h3 style={{ font: "700 17px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em", margin: 0 }}>
            {hasBlock ? "광고 게재 전에 해결할 게 있어요" : "광고 게재 전에 확인해주세요"}
          </h3>
          <p style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "8px 0 0" }}>
            {hasBlock
              ? "아래 항목을 해결해야 광고가 정상적으로 노출돼요."
              : "아래 항목을 확인한 뒤 광고를 게재할 수 있어요."}
          </p>
        </div>

        <div style={{ padding: "8px 26px 16px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {blockers.map((issue) => (
            <IssueCard key={issue.rule} issue={issue} onAction={handleAction} />
          ))}
          {warnings.map((issue) => (
            <IssueCard key={issue.rule} issue={issue} onAction={handleAction} />
          ))}

          {!hasBlock && warnings.length > 0 && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                위 항목을 확인했어요. 그대로 광고를 게재할게요.
              </span>
            </label>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled={!canProceed}
            onClick={onConfirm}
          >
            <Icon name="megaphone" size={14} /> 광고 게재 진행
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueCard({ issue, onAction }: { issue: ValidationIssue; onAction: (i: ValidationIssue) => void }) {
  const isBlock = issue.severity === "block";
  return (
    <div
      className={"callout " + (isBlock ? "callout--danger" : "callout--warn")}
      style={{ alignItems: "flex-start" }}
    >
      <Icon name={isBlock ? "warn" : "info"} size={16} />
      <div style={{ flex: 1 }}>
        <div style={{ font: "600 13.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 4 }}>
          {issue.title}
        </div>
        <div style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
          {issue.message}
        </div>
        {issue.action && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 8 }}
            onClick={() => onAction(issue)}
          >
            {issue.action.label} <Icon name="arrow-right" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
