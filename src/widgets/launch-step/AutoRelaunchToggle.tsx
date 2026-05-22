"use client";

// Auto Relaunch 토글 — STEP 02 디테일 탭 (PRD-auto-relaunch §7.1).
// 비활성 조건: end date / lifetime budget 없으면 토글 비활성.

import { useLaunchDraft } from "@entities/campaign/model";

export default function AutoRelaunchToggle() {
  const { state, dispatch } = useLaunchDraft();
  const hasEndDate = !!state.dateEnd;

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <div style={{ paddingTop: 2, flex: "0 0 auto" }}>
          <button
            type="button"
            role="switch"
            aria-checked={state.autoRelaunchEnabled}
            disabled={!hasEndDate}
            onClick={() => {
              if (!hasEndDate) return;
              dispatch({ type: "SET_AUTO_RELAUNCH_ENABLED", enabled: !state.autoRelaunchEnabled });
            }}
            style={{
              width: 36,
              height: 20,
              borderRadius: 999,
              border: "none",
              cursor: hasEndDate ? "pointer" : "not-allowed",
              background: !hasEndDate
                ? "var(--w-line-normal)"
                : state.autoRelaunchEnabled
                ? "var(--w-primary-normal)"
                : "var(--w-line-normal)",
              position: "relative",
              transition: "background 160ms",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: state.autoRelaunchEnabled ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                transition: "left 160ms",
              }}
            />
          </button>
        </div>
        <div>
          <div className="font-semibold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)]">
            자동 재게재
          </div>
          <p className="font-normal text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px] mb-0">
            {hasEndDate
              ? "성과가 목표를 통과하면 종료 후 알림 받아요. 매번 직접 확인 후 게재돼요."
              : "종료일을 설정해야 켤 수 있어요."}
          </p>
        </div>
      </div>
    </div>
  );
}
