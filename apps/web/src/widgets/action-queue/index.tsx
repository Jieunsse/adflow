"use client";

// "오늘의 진단" — 효과가 큰 순서로 1·2·3. 카드 하나 = 문장 하나 + 근거 숫자 + 지금 누를 버튼.

import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import type { ActionAccent, ActionButton, ActionItem } from "@entities/insights/action-queue";

const RANK_BG: Record<ActionAccent, string> = {
  negative: "var(--w-status-negative)",
  primary: "var(--w-primary-normal)",
  neutral: "var(--w-bg-alternative)",
};
const RANK_FG: Record<ActionAccent, string> = {
  negative: "var(--w-fg-on-color)",
  primary: "var(--w-fg-on-color)",
  neutral: "var(--w-fg-normal)",
};
const STAT_BG: Record<ActionAccent, string> = {
  negative: "var(--w-status-negative-soft)",
  primary: "var(--w-primary-soft)",
  neutral: "var(--w-bg-alternative)",
};
const STAT_LINE: Record<ActionAccent, string> = {
  negative: "var(--w-status-negative-line)",
  primary: "var(--w-line-alternative)",
  neutral: "var(--w-line-alternative)",
};
const STAT_STRONG_FG: Record<ActionAccent, string> = {
  negative: "var(--w-status-negative)",
  primary: "var(--w-primary-press)",
  neutral: "var(--w-fg-strong)",
};

export type ActionQueueProps = {
  loading: boolean;
  items: ActionItem[];
  onAction: (button: ActionButton) => void;
};

export function ActionQueue({ loading, items, onAction }: ActionQueueProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="m-0 font-bold text-[20px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">오늘의 진단</h2>
        <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">효과가 큰 순서로 정리했어요</span>
      </div>

      {loading ? (
        <>
          <Skeleton className="h-[220px] rounded-2xl" />
          <Skeleton className="h-[160px] rounded-2xl" />
        </>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl flex items-center gap-3.5 shadow-[var(--w-shadow-card)]">
          <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)]">
            <Icon name="check" size={17} />
          </span>
          <div>
            <div className="font-bold text-[17px] leading-[1.4] text-[var(--w-fg-strong)]">지금 손볼 게 없어요</div>
            <div className="font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] mt-0.5">
              새는 곳도, 급하게 올릴 곳도 안 보여요. 이대로 지켜봐도 괜찮아요.
            </div>
          </div>
        </Card>
      ) : (
        items.map((item, i) => <ActionCard key={item.id} item={item} rank={i + 1} onAction={onAction} />)
      )}
    </div>
  );
}

function ActionCard({ item, rank, onAction }: { item: ActionItem; rank: number; onAction: (b: ActionButton) => void }) {
  return (
    <Card className="rounded-2xl py-[26px] px-7 flex gap-5 shadow-[var(--w-shadow-card)] transition-shadow duration-150 hover:shadow-[var(--w-shadow-strong)]">
      <span
        className="shrink-0 grid place-items-center w-8 h-8 rounded-full font-bold text-[15px] leading-none"
        style={{ background: RANK_BG[item.accent], color: RANK_FG[item.accent] }}
      >
        {rank}
      </span>

      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <h3
          className="m-0 font-bold text-[19px] leading-7 tracking-[-0.01em] text-[var(--w-fg-strong)]"
          style={{ textWrap: "pretty" }}
        >
          {item.title}
        </h3>
        <p className="m-0 font-medium text-[15px] leading-6 text-[var(--w-fg-normal)]" style={{ textWrap: "pretty" }}>
          {item.body}
        </p>

        {item.stats.length > 0 && (
          <div
            className={cn(
              "rounded-xl py-3.5 px-4 flex gap-5",
              item.stats.length === 1 ? "items-center gap-3.5 flex-wrap" : "items-stretch",
            )}
            style={{ background: STAT_BG[item.accent] }}
          >
            {item.stats.length === 1 ? (
              <>
                <span className="font-medium text-[13px] text-[var(--w-fg-normal)]">{item.stats[0].label}</span>
                <span
                  className="font-bold text-[17px] leading-none [font-variant-numeric:tabular-nums]"
                  style={{ color: STAT_STRONG_FG[item.accent] }}
                >
                  {item.stats[0].value}
                </span>
              </>
            ) : (
              item.stats.flatMap((s, i) => [
                ...(i > 0 ? [<div key={`${s.label}-line`} className="w-px shrink-0" style={{ background: STAT_LINE[item.accent] }} />] : []),
                <div key={s.label} className="flex flex-col gap-0.5">
                  <span className="font-medium text-[12px] leading-none text-[var(--w-fg-neutral)]">{s.label}</span>
                  <span
                    className="font-bold text-[17px] leading-[1.3] [font-variant-numeric:tabular-nums]"
                    style={{ color: s.strong ? STAT_STRONG_FG[item.accent] : "var(--w-fg-strong)" }}
                  >
                    {s.value}
                  </span>
                </div>,
              ])
            )}
          </div>
        )}

        <div className="flex gap-2 mt-0.5 flex-wrap">
          {item.buttons.map((b) => (
            <Button key={b.label} variant={b.variant} size="md" type="button" onClick={() => onAction(b)}>
              {b.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
