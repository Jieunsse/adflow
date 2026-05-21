"use client";

// PRD §13.10 Q1 (B 결정) — outcome 미선택 시 노출되는 intro 화면.
// PRD §13.10.5 (2026-05-19) — 카드 비주얼 line-free + shadow only. /create 스코프 CSS 가 카드 base style 담당.

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { OBJECTIVES_PHASE1, OBJECTIVES_PHASE2, type ObjectiveId } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";

interface Props {
  /** outcome 선택 + "다음" 클릭 시 호출 — 보통 stepper 진입(step 0 = creative). */
  onNext: () => void;
}

interface CardProps {
  id: ObjectiveId;
  iconName: Parameters<typeof Icon>[0]["name"];
  label: string;
  copyTone: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function GoalCard({ id, iconName, label, copyTone, active, disabled, onClick }: CardProps) {
  const className = ["goal-card", active && "goal-card--active", disabled && "goal-card--disabled"]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      key={id}
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "곧 열려요 — Pixel/Lead Form/App SDK 등 추가 인프라가 필요한 광고 목표예요" : copyTone}
      className={className}
      style={{
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: "44px 18px",
        minHeight: 240,
        borderRadius: 18,
        color: active ? "var(--w-accent-violet)" : "var(--w-fg-strong)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      {disabled && (
        <span style={{
          position: "absolute",
          top: 12,
          right: 14,
          font: "600 10px/1 var(--w-font-sans)",
          padding: "4px 8px",
          borderRadius: 6,
          background: "var(--w-accent-violet)",
          color: "#fff",
          letterSpacing: 0.2,
        }}>곧</span>
      )}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: active ? "var(--w-primary-soft)" : "rgba(0, 102, 255, 0.06)",
          color: active ? "var(--w-accent-violet)" : "var(--w-primary-press)",
          display: "grid",
          placeItems: "center",
          transition: "background 120ms ease, color 120ms ease",
        }}
      >
        <Icon name={iconName} size={32} strokeWidth={1.7} />
      </div>
      <span style={{
        font: "700 15px/1.3 var(--w-font-sans)",
        textAlign: "center",
        color: active ? "var(--w-accent-violet)" : "var(--w-fg-strong)",
      }}>
        {label}
      </span>
    </button>
  );
}

export default function GoalIntro({ onNext }: Props) {
  const creative = useCreativeDraft();
  const outcome = creative.state.outcome;

  const handleSelect = (id: ObjectiveId) => {
    creative.dispatch({ type: "SET_OUTCOME", outcome: id === outcome ? null : id });
  };

  return (
    <div className="card card--lg" style={{ padding: 32 }}>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <h2 className="section-title" style={{ margin: 0 }}>어떤 광고를 만들까요?</h2>
        <Badge kind="neutral">필수</Badge>
      </div>
      <p className="section-sub" style={{ marginBottom: 24 }}>
        광고 목표에 따라 AI 카피와 Meta 캠페인 설정이 자동으로 맞춰져요.
      </p>

      {/* PRD §13.10.7 — flex-wrap + center 정렬로 빈 셀 제거. 4-col 기준 카드 폭은 동일 유지.
          마지막 row 가 부족하면(3 카드) 자동으로 가운데로 모임. */}
      {/* Phase 1 — 지금 사용 가능한 7 광고 목표 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
        {OBJECTIVES_PHASE1.map((o) => (
          <div key={o.id} style={{ flex: "0 0 calc((100% - 42px) / 4)", minWidth: 0 }}>
            <GoalCard
              id={o.id}
              iconName={o.iconName}
              label={o.label}
              copyTone={o.copyTone}
              active={outcome === o.id}
              onClick={() => handleSelect(o.id)}
            />
          </div>
        ))}
      </div>

      {/* Phase 2 — 추가 인프라(Pixel/Lead Form/App SDK) 필요. 분리된 row 로 시각 노이즈 줄임. */}
      <div style={{ marginTop: 36, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          font: "600 11.5px/1 var(--w-font-sans)",
          color: "var(--w-fg-neutral)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}>
          곧 열려요
        </span>
        <span style={{ font: "500 11px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}>
          · Pixel · Lead Form · App SDK 등 추가 인프라가 필요한 광고 목표
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 22 }}>
        {OBJECTIVES_PHASE2.map((o) => (
          <div key={o.id} style={{ flex: "0 0 calc((100% - 42px) / 4)", minWidth: 0 }}>
            <GoalCard
              id={o.id}
              iconName={o.iconName}
              label={o.label}
              copyTone={o.copyTone}
              active={false}
              disabled
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn btn--primary btn--lg"
          type="button"
          onClick={onNext}
          disabled={!outcome}
          title={!outcome ? "광고 목표를 먼저 골라주세요" : undefined}
        >
          다음 <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}
