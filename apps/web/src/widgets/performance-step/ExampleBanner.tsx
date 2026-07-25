"use client";

import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Card } from "@shared/ui/Card";

interface Props {
  scenario: "good" | "poor";
  setScenario: (s: "good" | "poor") => void;
}

export default function ExampleBanner({ scenario, setScenario }: Props) {
  return (
    <Card className="bg-[var(--w-accent-violet-soft)] border-transparent flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="text-[var(--w-accent-violet)] pt-0.5"><Icon name="info" size={18} /></div>
        <div>
          <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">아직 집행한 광고가 없어 예시 데이터를 보여드려요</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px]">실제로 광고를 집행하면 같은 화면에서 진짜 성과를 볼 수 있어요. (적용 버튼은 집행 후 활성화돼요)</div>
        </div>
      </div>
      <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]">
        <button
          type="button"
          onClick={() => setScenario("good")}
          className={cn(
            "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
            scenario === "good"
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
              : "bg-transparent text-[var(--w-fg-neutral)]"
          )}
        >양호 예시</button>
        <button
          type="button"
          onClick={() => setScenario("poor")}
          className={cn(
            "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
            scenario === "poor"
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
              : "bg-transparent text-[var(--w-fg-neutral)]"
          )}
        >개선 필요 예시</button>
      </div>
    </Card>
  );
}
