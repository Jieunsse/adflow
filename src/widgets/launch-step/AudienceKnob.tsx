"use client";

import { Badge } from "@shared/ui/primitives";
import { useToast } from "@shared/ui/Toast";
import { useLaunchDraft } from "@entities/campaign/model";
import SubHead from "./SubHead";

export default function AudienceKnob() {
  const showToast = useToast();
  const { state, dispatch } = useLaunchDraft();

  return (
    <>
      <SubHead title="맞춤 타겟 + 유사 타겟" subtitle="기존에 만든 맞춤 타겟을 선택하거나 유사 타겟을 자동 생성해요." />
      <select
        className="select"
        value=""
        onChange={() => {}}
        disabled
        style={{ marginBottom: 8 }}
        aria-label="맞춤 타겟"
      >
        <option value="">맞춤 타겟이 아직 없어요 — Meta 광고 관리자에서 만들어주세요</option>
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={state.lookalikeEnabled}
          onChange={(e) => {
            dispatch({ type: "SET_LOOKALIKE_ENABLED", enabled: e.target.checked });
            if (e.target.checked) showToast("유사 타겟 자동 생성은 곧 적용돼요");
          }}
        />
        <span style={{ font: "500 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
          유사 타겟(lookalike) 자동 생성
        </span>
        <Badge kind="neutral">곧 연동</Badge>
      </label>
    </>
  );
}
