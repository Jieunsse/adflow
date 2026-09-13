import type { ReactNode } from "react";
import Icon, { type IconName } from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";

export function ErrorState({
  icon = "warn",
  title,
  reason,
  onAction,
  ctaLabel = "다시 시도",
}: {
  icon?: IconName;
  title: string;
  reason: ReactNode;
  onAction?: () => void;
  ctaLabel?: string;
}) {
  return (
    <Card className="py-10 px-8 flex flex-col items-center gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)] grid place-items-center">
        <Icon name={icon} size={24} />
      </div>
      <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)] tracking-[-0.01em]">{title}</div>
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] max-w-[380px]">{reason}</div>
      {onAction && <Button variant="secondary" type="button" className="mt-2" onClick={onAction}>{ctaLabel}</Button>}
    </Card>
  );
}
