import type { CSSProperties, ReactNode } from "react";
import Icon, { type IconName } from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

export type CalloutTone = "positive" | "negative" | "cautionary";

const TONE_BG: Record<CalloutTone, string> = {
  positive: "var(--w-status-positive-soft)",
  negative: "var(--w-status-negative-soft)",
  cautionary: "var(--w-status-cautionary-soft)",
};
const TONE_LINE: Record<CalloutTone, string> = {
  positive: "var(--w-status-positive-line)",
  negative: "var(--w-status-negative-line)",
  cautionary: "var(--w-status-cautionary-line)",
};
const TONE_FG: Record<CalloutTone, string> = {
  positive: "var(--w-status-positive)",
  negative: "var(--w-status-negative)",
  cautionary: "var(--w-status-cautionary)",
};

// ADR-049 — status 틴트(bg-soft + line) 박스를 토큰 단일 소스로 흡수. 배너(md)·인라인 노티스(sm) 공용.
// 본문 텍스트 색은 caller 가 children 으로 직접 제어(거절 사유처럼 status 색 본문도 있어서 auto-style 안 함).
export function Callout({
  tone,
  icon,
  title,
  actions,
  size = "md",
  className,
  style,
  children,
}: {
  tone: CalloutTone;
  icon?: IconName;
  title?: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const sm = size === "sm";
  return (
    <div
      className={className}
      style={{
        background: TONE_BG[tone],
        border: `1px solid ${TONE_LINE[tone]}`,
        borderRadius: sm ? 8 : 12,
        padding: sm ? "10px 14px" : "16px 18px",
        display: "flex",
        alignItems: sm ? "flex-start" : "center",
        gap: sm ? 8 : 14,
        flexWrap: sm ? undefined : "wrap",
        ...style,
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={sm ? 14 : 20}
          style={{ color: TONE_FG[tone], flex: "0 0 auto", marginTop: sm ? 1 : 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: sm ? undefined : 200 }}>
        {title && (
          <div
            className={cn(
              sm ? "font-semibold text-[13px] leading-[1.3]" : "font-bold text-[16px] leading-[1.3]",
              "text-[var(--w-fg-strong)]",
            )}
          >
            {title}
          </div>
        )}
        {children && <div style={title ? { marginTop: 4 } : undefined}>{children}</div>}
      </div>
      {actions && <div style={{ display: "inline-flex", gap: 8, flex: "0 0 auto" }}>{actions}</div>}
    </div>
  );
}
