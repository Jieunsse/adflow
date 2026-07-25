"use client";

import { cn } from "@shared/lib/cn";
import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import { GOAL_RESULT, type ObjectivePhase1Id } from "@entities/creative/options";
import SubHead from "./SubHead";

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";

export default function BidStrategyKnob() {
  const { state, dispatch } = useLaunchDraft();
  const { state: creative } = useCreativeDraft();

  const outcomeId = creative.outcome;
  const result = outcomeId && outcomeId in GOAL_RESULT
    ? GOAL_RESULT[outcomeId as ObjectivePhase1Id]
    : GOAL_RESULT.traffic;

  return (
    <>
      <SubHead title="입찰 전략" subtitle={`AI: 첫 캠페인엔 '최저 비용'이 안전해요. ${result.noun} 결과를 빠르게 얻을 수 있어요.`} />
      <div className="flex flex-wrap gap-2 mb-2">
        {[
          { id: "LOWEST_COST_WITHOUT_CAP" as const, label: "최저 비용" },
          { id: "LOWEST_COST_WITH_BID_CAP" as const, label: "대상 비용" },
          { id: "COST_CAP" as const, label: "목표 단가" },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            className={cn(chipBase, state.bidStrategy === b.id && chipOn)}
            onClick={() => dispatch({ type: "SET_BID_STRATEGY", strategy: b.id })}
          >
            {b.label}
          </button>
        ))}
      </div>
      {state.bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && (
        <div className="flex items-stretch border border-[var(--w-line-normal)] rounded-xl overflow-hidden bg-[var(--w-bg-elevated)] focus-within:border-[var(--w-primary-normal)] focus-within:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] transition-[border-color,box-shadow] duration-[120ms] mb-3 max-w-[240px]">
          <span className="grid place-items-center px-[14px] font-semibold text-[14px] leading-none text-[var(--w-fg-neutral)] bg-[var(--w-bg-alternative)] border-r border-[var(--w-line-normal)]">₩</span>
          <input
            inputMode="numeric"
            placeholder={state.bidStrategy === "LOWEST_COST_WITH_BID_CAP" ? `${result.costLabel} 상한 (KRW)` : `${result.costLabel} 목표 (KRW)`}
            value={state.bidAmount?.toLocaleString("ko-KR") ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
              dispatch({ type: "SET_BID_AMOUNT", amount: Number.isFinite(n) ? n : null });
            }}
            className="border-none flex-1 px-[14px] py-3 bg-transparent font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none"
            aria-label="입찰 금액"
          />
        </div>
      )}
    </>
  );
}
