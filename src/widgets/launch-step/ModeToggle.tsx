"use client";

import Icon from "@shared/ui/Icon";
import { useLaunchDraft } from "@entities/campaign/model";

const MODES = [
  {
    id: "simple" as const,
    icon: "sparkles" as const,
    label: "간단 설정",
    badge: "추천",
    desc: "최소 입력으로 빠르게 집행해요.",
    bullets: ["캠페인 목표: 트래픽 자동 고정", "어드밴티지+ 타겟 · 노출 위치", "자동 입찰 (최저 비용)"],
  },
  {
    id: "detailed" as const,
    icon: "settings" as const,
    label: "디테일 설정",
    badge: null,
    desc: "목표·타겟·입찰을 직접 설정해요.",
    bullets: ["캠페인 목표 직접 선택", "맞춤·유사 타겟", "입찰 전략·금액 설정"],
  },
];

export default function ModeToggle() {
  const { state, dispatch } = useLaunchDraft();

  const handleSwitch = (target: "simple" | "detailed") => {
    if (target === state.mode) return;
    dispatch({ type: "SET_MODE", mode: target });
  };

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {MODES.map((m) => {
          const selected = state.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSwitch(m.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 0,
                padding: "16px 18px",
                borderRadius: "var(--w-radius-16)",
                border: `2px solid ${selected ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
                background: selected ? "var(--w-accent-violet-soft)" : "var(--w-bg-elevated)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, background 0.15s",
                boxShadow: selected ? "none" : "var(--w-shadow-card)",
              }}
              aria-pressed={selected}
            >
              {/* 헤더 행 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 10 }}>
                {/* 아이콘 pill */}
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: "var(--w-radius-8)",
                  background: selected ? "rgba(101,65,242,0.14)" : "var(--w-bg-alternative)",
                  flexShrink: 0,
                }}>
                  <Icon name={m.icon} size={16} style={{ color: selected ? "var(--w-accent-violet)" : "var(--w-fg-neutral)" }} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      font: `700 15px/1.25 var(--w-font-sans)`,
                      letterSpacing: "var(--w-tracking-heading)",
                      color: selected ? "var(--w-accent-violet)" : "var(--w-fg-strong)",
                    }}>
                      {m.label}
                    </span>
                    {m.badge && (
                      <span className="badge--violet" style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--w-radius-pill)", letterSpacing: "0.02em" }}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* 선택 인디케이터 */}
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `2px solid ${selected ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
                  background: selected ? "var(--w-accent-violet)" : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border-color 0.15s, background 0.15s",
                }}>
                  {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </div>

              {/* 설명 */}
              <p style={{ margin: "0 0 10px", font: "500 13px/1.5 var(--w-font-sans)", color: selected ? "var(--w-fg-neutral)" : "var(--w-fg-normal)", letterSpacing: "var(--w-tracking-body)" }}>
                {m.desc}
              </p>

              {/* 구분선 */}
              <div style={{ width: "100%", height: 1, background: selected ? "rgba(101,65,242,0.15)" : "var(--w-line-alternative)", marginBottom: 10 }} />

              {/* 불릿 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {m.bullets.map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: selected ? "var(--w-accent-violet)" : "var(--w-fg-neutral)",
                      flexShrink: 0,
                    }} />
                    <span style={{ font: "500 12px/1.4 var(--w-font-sans)", color: selected ? "rgba(101,65,242,0.75)" : "var(--w-fg-normal)", letterSpacing: "var(--w-tracking-caption)" }}>
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
    </div>
  );
}
