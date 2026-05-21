"use client";

// STEP 02 detailed mode — 선택된 광고 목표 표시. SelectedGoalCard 재사용 wrapper.
// PRD §13.10.6 — "변경" 클릭 시 intro 로 직행 (goCreative 가 handleChangeOutcome 으로 routing).

import SelectedGoalCard from "@entities/creative/ui/SelectedGoalCard";

interface Props {
  goCreative: () => void;
}

export default function ObjectivePicker({ goCreative }: Props) {
  return <SelectedGoalCard onChange={goCreative} changeLabel="광고 목표 변경" />;
}
