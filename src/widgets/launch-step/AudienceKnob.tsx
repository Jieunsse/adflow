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
        className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] appearance-none pr-9 cursor-pointer mb-2"
        value=""
        onChange={() => {}}
        disabled
        aria-label="맞춤 타겟"
      >
        <option value="">맞춤 타겟이 아직 없어요 — Meta 광고 관리자에서 만들어주세요</option>
      </select>
      <label className="flex items-center gap-2.5 mb-1">
        <input
          type="checkbox"
          checked={state.lookalikeEnabled}
          onChange={(e) => {
            dispatch({ type: "SET_LOOKALIKE_ENABLED", enabled: e.target.checked });
            if (e.target.checked) showToast("유사 타겟 자동 생성은 곧 적용돼요");
          }}
        />
        <span className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">
          유사 타겟(lookalike) 자동 생성
        </span>
        <Badge kind="neutral">곧 연동</Badge>
      </label>
    </>
  );
}
