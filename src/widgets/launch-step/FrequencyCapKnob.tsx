"use client";

// PRD-objective-aware-launch §3 — awareness 의 빈도 캡 노브. uniqueSection 'frequency_cap'.
// "사용자 1인당 N일에 최대 M회 노출" — Meta AdSet.frequency_control_specs 와 매핑.
// V1 = UI 만, 실 게재 적용은 후속(launch-campaign build 확장 필요).

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { cn } from "@shared/lib/cn";
import { useLaunchDraft } from "@entities/campaign/model";
import SubHead from "./SubHead";

const DAY_PRESETS = [3, 7] as const;
const IMPRESSION_PRESETS = [1, 2, 3] as const;

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";

export default function FrequencyCapKnob() {
  const { state, dispatch } = useLaunchDraft();
  const fc = state.frequencyCap;
  const enabled = fc !== null;

  const toggle = (next: boolean) => {
    if (next) dispatch({ type: "SET_FREQUENCY_CAP", value: { impressions: 2, days: 7 } });
    else dispatch({ type: "SET_FREQUENCY_CAP", value: null });
  };
  const setImpressions = (n: number) => {
    dispatch({ type: "SET_FREQUENCY_CAP", value: { impressions: n, days: fc?.days ?? 7 } });
  };
  const setDays = (n: number) => {
    dispatch({ type: "SET_FREQUENCY_CAP", value: { impressions: fc?.impressions ?? 2, days: n } });
  };

  return (
    <>
      <label className="flex items-start gap-2.5 mb-2.5">
        <input
          type="checkbox"
          className="mt-[3px]"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
        />
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)]">
            노출 피로도 관리 (빈도 캡) <Badge kind="neutral">곧 연동</Badge>
          </div>
          <p className="font-normal text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px] mb-0">
            같은 사람에게 광고가 반복 노출되지 않도록 1인당 노출 횟수를 제한해요. 인지도 캠페인에 효과적이에요.
          </p>
        </div>
      </label>

      {enabled && fc && (
        <div className="ml-7 flex flex-col gap-3 mt-2 mb-1">
          <div>
            <SubHead title="기간" />
            <div className="flex flex-wrap gap-2">
              {DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={cn(chipBase, fc.days === d && chipOn)}
                  onClick={() => setDays(d)}
                >
                  {d}일
                </button>
              ))}
            </div>
          </div>
          <div>
            <SubHead title="최대 노출 횟수" />
            <div className="flex flex-wrap gap-2">
              {IMPRESSION_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(chipBase, fc.impressions === n && chipOn)}
                  onClick={() => setImpressions(n)}
                >
                  {n}회
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">
            <Icon name="info" size={12} /> 한 사람에게 {fc.days}일 동안 최대 {fc.impressions}회 노출돼요.
          </div>
        </div>
      )}
    </>
  );
}
