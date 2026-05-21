"use client";

import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import { GOAL_RESULT, type ObjectivePhase1Id } from "@entities/creative/options";
import SubHead from "./SubHead";

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
      <div className="chips" style={{ marginBottom: 8 }}>
        {[
          { id: "LOWEST_COST_WITHOUT_CAP" as const, label: "최저 비용" },
          { id: "LOWEST_COST_WITH_BID_CAP" as const, label: "대상 비용" },
          { id: "COST_CAP" as const, label: "목표 단가" },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            className={"chip" + (state.bidStrategy === b.id ? " chip--on" : "")}
            onClick={() => dispatch({ type: "SET_BID_STRATEGY", strategy: b.id })}
          >
            {b.label}
          </button>
        ))}
      </div>
      {state.bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && (
        <div className="input--addon" style={{ marginBottom: 12, maxWidth: 240 }}>
          <span className="addon">₩</span>
          <input
            inputMode="numeric"
            placeholder={state.bidStrategy === "LOWEST_COST_WITH_BID_CAP" ? `${result.costLabel} 상한 (KRW)` : `${result.costLabel} 목표 (KRW)`}
            value={state.bidAmount?.toLocaleString("ko-KR") ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
              dispatch({ type: "SET_BID_AMOUNT", amount: Number.isFinite(n) ? n : null });
            }}
            aria-label="입찰 금액"
          />
        </div>
      )}
    </>
  );
}
