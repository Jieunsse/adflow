"use client";

import { useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@shared/ui/Dialog";
import type { CreatorPerformance } from "@entities/creator/model";

const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)] transition-[border-color,box-shadow] duration-[120ms]";

const LABEL_CLASS = "font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]";

function toNumber(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

export function PerformanceInputModal({
  creatorHandle,
  initialPerformance,
  onClose,
  onSave,
}: {
  creatorHandle: string;
  initialPerformance?: CreatorPerformance;
  onClose: () => void;
  onSave: (perf: { reach?: number; clicks?: number; conversions?: number; revenue?: number; cost?: number }) => void;
}) {
  const [reach, setReach] = useState(initialPerformance?.reach != null ? String(initialPerformance.reach) : "");
  const [clicks, setClicks] = useState(initialPerformance?.clicks != null ? String(initialPerformance.clicks) : "");
  const [conversions, setConversions] = useState(
    initialPerformance?.conversions != null ? String(initialPerformance.conversions) : "",
  );
  const [revenue, setRevenue] = useState(initialPerformance?.revenue != null ? String(initialPerformance.revenue) : "");
  const [cost, setCost] = useState(initialPerformance?.cost != null ? String(initialPerformance.cost) : "");

  const handleSave = () => {
    onSave({
      reach: toNumber(reach),
      clicks: toNumber(clicks),
      conversions: toNumber(conversions),
      revenue: toNumber(revenue),
      cost: toNumber(cost),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 460 }}>
        <div className="px-6 pt-6 pb-2">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">
            성과 입력
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              {creatorHandle} — 게시물에서 확인한 숫자를 입력하면 리포트와 다음 캠페인 추천에 반영돼요.
            </div>
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>도달</label>
            <input className={INPUT_CLASS} type="number" value={reach} onChange={(e) => setReach(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>클릭</label>
            <input className={INPUT_CLASS} type="number" value={clicks} onChange={(e) => setClicks(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>전환</label>
            <input
              className={INPUT_CLASS}
              type="number"
              value={conversions}
              onChange={(e) => setConversions(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>매출</label>
            <input className={INPUT_CLASS} type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="입력하면 ROAS 가 계산돼요" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>협업비</label>
            <input className={INPUT_CLASS} type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
          </div>
          <div className="flex items-start gap-1.5 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]">
            <Icon name="info" size={13} className="mt-px shrink-0" />
            <span>매출과 협업비를 모두 입력해야 ROAS 가 표시돼요.</span>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)]">
          <Button variant="ghost" type="button" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" type="button" onClick={handleSave}>
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
