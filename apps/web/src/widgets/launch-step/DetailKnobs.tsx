"use client";

// 고급 설정 접힘 섹션(PRD-create-flow-redesign §3.3). uniqueSections 별 조건부 마운트.
// A/B 시험(ABCreativeKnob)은 1급 카드로 분리돼 여기 포함되지 않는다.
//   (1) BidStrategyKnob    — 입찰 전략 + (cap 일 때) bidAmount
//   (2) AudienceKnob       — 맞춤 타겟 프리셋 3종 (ADR-062)
//   (3) PlacementKnob      — 광고 플랫폼 + 세부 위치 (profile.placement 분기)
//   (3.5) FrequencyCapKnob — awareness 만 (uniqueSection 'frequency_cap')
//   (4) 자동 되돌림 guardrail — UI 만

import { Chip } from "@shared/ui/Chip";
import { useToast } from "@shared/ui/Toast";
import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import { GOAL_RESULT, type ObjectivePhase1Id } from "@entities/creative/options";
import { profileOf } from "@entities/launch-objective/profile";

import BidStrategyKnob from "./BidStrategyKnob";
import AudienceKnob from "./AudienceKnob";
import PlacementKnob from "./PlacementKnob";
import FrequencyCapKnob from "./FrequencyCapKnob";
import AutoRelaunchToggle from "./AutoRelaunchToggle";

export default function DetailKnobs() {
  const showToast = useToast();
  const { state, dispatch } = useLaunchDraft();
  const { state: creative } = useCreativeDraft();

  const outcomeId = creative.outcome;
  const result = outcomeId && outcomeId in GOAL_RESULT
    ? GOAL_RESULT[outcomeId as ObjectivePhase1Id]
    : GOAL_RESULT.traffic;
  const profile = profileOf(outcomeId);
  const showFrequencyCap = profile?.uniqueSections.includes("frequency_cap") ?? false;

  return (
    <>
      <BidStrategyKnob />
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

      <AudienceKnob />
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

      <PlacementKnob />
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

      {showFrequencyCap && (
        <>
          <FrequencyCapKnob />
          <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        </>
      )}

      <AutoRelaunchToggle />
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

      <label className="flex items-start gap-2.5 mb-2.5">
        <input
          type="checkbox"
          className="mt-[3px]"
          checked={state.autoPauseGuardrailEnabled}
          onChange={(e) => {
            dispatch({ type: "SET_AUTO_PAUSE_GUARDRAIL", enabled: e.target.checked });
            if (e.target.checked) showToast("자동 광고중단은 곧 연동돼요");
          }}
        />
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
            성과 기준 미달 시 자동 광고중단 <Chip variant="neutral">곧 연동</Chip>
          </div>
          <p className="font-normal text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px] mb-0">
            첫 3일 동안 {result.costLabel} 기준으로 광고 계정 평균 대비 2배 넘으면 자동으로 일시정지해요.
          </p>
        </div>
      </label>
    </>
  );
}
