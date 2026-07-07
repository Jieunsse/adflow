"use client";

import { useLaunchDraft } from "@entities/campaign/model";
import { fmtBudget } from "@shared/lib/launch-utils";
import { calcDaysBetween, estimateImpressionRange } from "@entities/insights/budget-estimates";
import { fmt } from "@shared/lib/format";
import SubHead from "./SubHead";
import DatePicker from "@shared/ui/DatePicker";
import { cn } from "@shared/lib/cn";

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";

export default function BudgetScheduleStep() {
  const { state, dispatch } = useLaunchDraft();
  const budgetNum = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
  const days = calcDaysBetween(state.dateStart, state.dateEnd);
  const { min: impMin, max: impMax } = estimateImpressionRange(budgetNum, days);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <SubHead title="일일 예산" />
        <div className="flex items-stretch border border-[var(--w-line-normal)] rounded-xl overflow-hidden bg-[var(--w-bg-elevated)] focus-within:border-[var(--w-primary-normal)] focus-within:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] transition-[border-color,box-shadow] duration-[120ms]">
          <span className="grid place-items-center px-[14px] font-semibold text-[14px] leading-none text-[var(--w-fg-neutral)] bg-[var(--w-bg-alternative)] border-r border-[var(--w-line-normal)]">₩</span>
          <input
            className="border-none flex-1 px-[14px] py-3 bg-transparent font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none"
            value={state.budget}
            onChange={(e) => dispatch({ type: "SET_BUDGET", value: fmtBudget(e.target.value) })}
            inputMode="numeric"
            placeholder="50,000"
            aria-label="일일 예산"
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {["30,000", "50,000", "100,000", "200,000"].map((preset) => (
            <button
              key={preset}
              type="button"
              className={cn(chipBase, state.budget === preset && chipOn)}
              onClick={() => dispatch({ type: "SET_BUDGET", value: preset })}
            >
              ₩{preset}
            </button>
          ))}
        </div>
        <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]" style={{ marginTop: 8 }}>
          최소 ₩10,000부터 설정할 수 있어요.
        </div>
      </div>
      <div>
        <SubHead title="집행 기간" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
          <DatePicker
            value={state.dateStart}
            onChange={(v) => dispatch({ type: "SET_DATE_START", value: v })}
            placeholder="시작일"
            aria-label="시작일"
          />
          <span style={{ color: "var(--w-fg-neutral)", textAlign: "center" }}>—</span>
          <DatePicker
            value={state.dateEnd}
            onChange={(v) => dispatch({ type: "SET_DATE_END", value: v })}
            placeholder="종료일"
            aria-label="종료일"
          />
        </div>
      </div>
      {(budgetNum > 0 || days > 0) && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 4,
          padding: "12px 16px", borderRadius: 10,
          background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)",
          font: "500 13px/1.4 var(--w-font-sans)",
        }}>
          <span>
            {days > 0 ? `${days}일간 ` : ""}예상 노출 {fmt(impMin)} – {fmt(impMax)}회
          </span>
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)]">업계 평균 CPM 가정 기준 대략 추정한 값이에요.</span>
        </div>
      )}
    </div>
  );
}
