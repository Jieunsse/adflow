"use client";

// PRD-objective-aware-launch §3 — awareness 의 빈도 캡 노브. uniqueSection 'frequency_cap'.
// "사용자 1인당 N일에 최대 M회 노출" — Meta AdSet.frequency_control_specs 와 매핑.
// V1 = UI 만, 실 게재 적용은 후속(launch-campaign build 확장 필요).

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { useLaunchDraft } from "@entities/campaign/model";
import SubHead from "./SubHead";

const DAY_PRESETS = [3, 7] as const;
const IMPRESSION_PRESETS = [1, 2, 3] as const;

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
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <input
          type="checkbox"
          style={{ marginTop: 3 }}
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            노출 피로도 관리 (빈도 캡) <Badge kind="neutral">곧 연동</Badge>
          </div>
          <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "3px 0 0" }}>
            같은 사람에게 광고가 반복 노출되지 않도록 1인당 노출 횟수를 제한해요. 인지도 캠페인에 효과적이에요.
          </p>
        </div>
      </label>

      {enabled && fc && (
        <div style={{ margin: "8px 0 4px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <SubHead title="기간" />
            <div className="chips">
              {DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={"chip" + (fc.days === d ? " chip--on" : "")}
                  onClick={() => setDays(d)}
                >
                  {d}일
                </button>
              ))}
            </div>
          </div>
          <div>
            <SubHead title="최대 노출 횟수" />
            <div className="chips">
              {IMPRESSION_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={"chip" + (fc.impressions === n ? " chip--on" : "")}
                  onClick={() => setImpressions(n)}
                >
                  {n}회
                </button>
              ))}
            </div>
          </div>
          <div className="field__hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="info" size={12} /> 한 사람에게 {fc.days}일 동안 최대 {fc.impressions}회 노출돼요.
          </div>
        </div>
      )}
    </>
  );
}
