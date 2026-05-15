"use client";

// 디테일 모드 전용 — 6개 캠페인 목표 라디오 칩 + 카피 부합성 callout.

import Icon from "@shared/ui/Icon";
import { OBJECTIVES_PHASE1, OBJECTIVES_PHASE2, OBJECTIVES_ALL } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";
import SubHead from "./SubHead";

interface Props {
  goCreative: () => void;
}

export default function ObjectivePicker({ goCreative }: Props) {
  const creative = useCreativeDraft();

  const primaryChip = creative.state.outcomeChips[0] ?? null;
  const expectedObjective = primaryChip
    ? OBJECTIVES_ALL.find((o) => o.id === primaryChip)?.metaObjective
    : null;
  const objectiveMismatch =
    !!primaryChip &&
    !!creative.state.objective &&
    !!expectedObjective &&
    creative.state.objective !== expectedObjective;

  return (
    <>
      <SubHead title="캠페인 목표" subtitle="6개 중 하나를 골라요." />
      <div className="chips" style={{ marginBottom: 12 }}>
        {OBJECTIVES_PHASE1.map((o) => (
          <button
            key={o.id}
            type="button"
            className={"chip" + (creative.state.objective === o.metaObjective ? " chip--on" : "")}
            onClick={() => creative.dispatch({ type: "SET_OBJECTIVE", objective: o.metaObjective })}
            title={o.copyTone}
          >
            {o.label}
          </button>
        ))}
        {OBJECTIVES_PHASE2.map((o) => (
          <button
            key={o.id}
            type="button"
            className={"chip" + (creative.state.objective === o.metaObjective ? " chip--on" : "")}
            onClick={() => creative.dispatch({ type: "SET_OBJECTIVE", objective: o.metaObjective })}
            title={o.copyTone}
          >
            {o.label}
          </button>
        ))}
      </div>

      {objectiveMismatch && expectedObjective && (
        <div className="callout callout--warn" style={{ marginBottom: 14 }}>
          <Icon name="warn" size={16} />
          <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", flex: 1 }}>
            AI가 추천한 목표는 <strong>{OBJECTIVES_ALL.find((o) => o.metaObjective === expectedObjective)?.label}</strong>이었어요.
            변경한 목표에는 카피 톤이 안 맞을 수 있어요.
          </div>
          <button className="btn btn--ghost btn--sm" type="button" onClick={goCreative}>
            STEP 01에서 카피 다시 만들기 <Icon name="arrow-right" size={13} />
          </button>
        </div>
      )}
    </>
  );
}
