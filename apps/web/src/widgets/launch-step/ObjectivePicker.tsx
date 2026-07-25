"use client";

// 게재(STEP 02) detailed mode — 선택된 광고 목표 표시. SelectedGoalCard 재사용 wrapper.
// PRD-create-flow-redesign §3.4 — "변경" 클릭 시 스튜디오(step 1) 로 비파괴 복귀 (goCreative = () => setStep(1)).

import SelectedGoalCard from "@entities/creative/ui/SelectedGoalCard";

interface Props {
  goCreative: () => void;
}

export default function ObjectivePicker({ goCreative }: Props) {
  return <SelectedGoalCard onChange={goCreative} changeLabel="광고 목표 변경" />;
}
