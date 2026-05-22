"use client";

// PRD-objective-aware-launch §3·§4.1 — 목표별 placement 분기.
//   default: 'auto'   → traffic. 사용자는 자동/수동 선택 가능.
//   default: 'manual' → 나머지. 권장 positions seed + recommendation 문구.
//   allowedPositions  → leads_call 의 Call 미지원 placement(Stories) 비활성.

import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import { GOAL_RESULT, type ObjectivePhase1Id } from "@entities/creative/options";
import {
  LAUNCH_PROFILES,
  type PlacementPosition,
} from "@entities/launch-objective/profile";
import SubHead from "./SubHead";

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";

const segBtnBase = "border-none bg-transparent px-[14px] py-2 rounded-lg font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)] cursor-pointer transition-[background,color] duration-[120ms]";
const segBtnOn = "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]";

export default function PlacementKnob() {
  const { state, dispatch } = useLaunchDraft();
  const { state: creative } = useCreativeDraft();

  const outcomeId = creative.outcome;
  const result = outcomeId && outcomeId in GOAL_RESULT
    ? GOAL_RESULT[outcomeId as ObjectivePhase1Id]
    : GOAL_RESULT.traffic;
  const profile = outcomeId && outcomeId in LAUNCH_PROFILES
    ? LAUNCH_PROFILES[outcomeId as ObjectivePhase1Id]
    : LAUNCH_PROFILES.traffic;

  return (
    <>
      <SubHead title="광고 플랫폼" subtitle="페이스북·인스타그램 중 어디에 노출할지 고르고, 필요하면 아래에서 세부 위치까지 정해요." />
      <div className="flex flex-wrap gap-2 mb-3.5">
        {([
          { id: "both" as const, label: "페이스북 · 인스타그램" },
          { id: "facebook" as const, label: "페이스북만" },
          { id: "instagram" as const, label: "인스타그램만" },
        ]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={cn(chipBase, state.platforms === opt.id && chipOn)}
            onClick={() => {
              dispatch({ type: "SET_PLATFORMS", platforms: opt.id });
              if (state.placements.mode === "manual") {
                const allowed = opt.id === "facebook" ? ["facebook_feed"]
                  : opt.id === "instagram" ? ["instagram_feed", "instagram_stories"]
                  : ["facebook_feed", "instagram_feed", "instagram_stories", "audience_network", "messenger"];
                const filtered = state.placements.positions.filter((p) => allowed.includes(p));
                if (filtered.length !== state.placements.positions.length) {
                  dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: filtered } });
                }
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <SubHead
        title="세부 위치"
        subtitle={profile.placement.recommendation ?? `자동을 권해요. 보통 자동이 더 효율적이에요 (${result.costLabel} 기준).`}
      />
      <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px] mb-2.5">
        <button
          type="button"
          className={cn(segBtnBase, state.placements.mode === "auto" && segBtnOn)}
          onClick={() => dispatch({ type: "SET_PLACEMENTS", placements: { mode: "auto" } })}
        >
          자동 (Advantage+)
        </button>
        <button
          type="button"
          className={cn(segBtnBase, state.placements.mode === "manual" && segBtnOn)}
          onClick={() => {
            const defaults = state.platforms === "facebook" ? ["facebook_feed"]
              : state.platforms === "instagram" ? ["instagram_feed"]
              : ["facebook_feed", "instagram_feed"];
            const seed = state.placements.mode === "manual"
              ? state.placements.positions
              : (profile.placement.recommendedPositions ?? defaults);
            dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: seed } });
          }}
        >
          수동
        </button>
      </div>
      {state.placements.mode === "manual" && (
        <div className="flex flex-wrap gap-2 mb-1">
          {[
            { id: "facebook_feed" as PlacementPosition, label: "Facebook 피드", platform: "facebook" as const },
            { id: "instagram_feed" as PlacementPosition, label: "Instagram 피드", platform: "instagram" as const },
            { id: "instagram_stories" as PlacementPosition, label: "Instagram 스토리", platform: "instagram" as const },
            { id: "audience_network" as PlacementPosition, label: "Audience Network", platform: "both" as const },
            { id: "messenger" as PlacementPosition, label: "Messenger", platform: "both" as const },
          ].map((pos) => {
            const positions = state.placements.mode === "manual" ? state.placements.positions : [];
            const on = positions.includes(pos.id);
            const allowedByPlatform =
              state.platforms === "both" ||
              pos.platform === "both" ||
              pos.platform === state.platforms;
            const allowedByObjective = !profile.placement.allowedPositions
              || profile.placement.allowedPositions.includes(pos.id);
            const enabled = allowedByPlatform && allowedByObjective;
            const blockReason = !allowedByPlatform
              ? "광고 플랫폼에서 해당 채널을 먼저 선택해 주세요"
              : !allowedByObjective
                ? "이 광고 목표는 해당 위치를 지원하지 않아요"
                : undefined;
            return (
              <button
                key={pos.id}
                type="button"
                className={cn(chipBase, on && chipOn, !enabled && "opacity-45")}
                disabled={!enabled}
                title={blockReason}
                onClick={() => {
                  const next = on ? positions.filter((x) => x !== pos.id) : [...positions, pos.id];
                  dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: next } });
                }}
              >
                {pos.label}
              </button>
            );
          })}
        </div>
      )}
      {profile.placement.allowedPositions && profile.placement.allowedPositions.length < 5 && (
        <div className="flex items-center gap-1.5 font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] mt-2">
          <Icon name="info" size={12} /> {profile.placement.recommendation}
        </div>
      )}
    </>
  );
}
