"use client";

// STEP 01 소재 정보 입력 카드 — 브랜드/타겟 입력, 톤 선택, AI 카피 생성.
// PRD §13.10 — 광고 목표 카드 grid 와 outcomeHint 는 intro 페이지로 이관. STEP 01 에선
// SelectedGoalCard 로 선택한 목표만 read-only 노출하고 "변경" 시 intro 로 복귀.

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { OBJECTIVES_PHASE1, TONES, type ToneId } from "@entities/creative/options";
import SelectedGoalCard from "@entities/creative/ui/SelectedGoalCard";
import { useCreativeDraft } from "@entities/creative/model";

interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  tone: ToneId;
  setTone: (id: ToneId) => void;
  /** outcome 변경(→ intro 복귀) 콜백. SelectedGoalCard 의 "광고 목표 변경" 버튼이 호출. */
  onChangeOutcome: () => void;
  generating: boolean;
  onGenerate: () => void;
}

export default function InputForm(p: Props) {
  // PRD §13.10 — outcomeHint 는 STEP 01 에서 (intro 에서 이관). 컨텍스트로 직접 접근.
  const creative = useCreativeDraft();

  // PRD-objective-aware-launch §5.2 — outcome 변경 후 STEP 01 복귀 시 stale 카피 안내.
  const prevOutcome = creative.state.previousOutcome;
  const hasCopy = creative.state.headlineCandidates !== null;
  const showStaleBanner = prevOutcome !== null && hasCopy;
  const prevLabel = prevOutcome ? OBJECTIVES_PHASE1.find((o) => o.id === prevOutcome)?.label ?? prevOutcome : "";

  return (
    <div className="card card--lg">
      <div className="between" style={{ marginBottom: 4 }}>
        <h2 className="section-title">소재 정보 입력</h2>
        <Badge kind="neutral">필수</Badge>
      </div>
      <p className="section-sub" style={{ marginBottom: 22 }}>선택한 광고 목표에 맞춰 AI가 카피를 만들어요.</p>

      <SelectedGoalCard onChange={p.onChangeOutcome} />

      {showStaleBanner && (
        <div className="callout callout--warn" style={{ marginBottom: 16, alignItems: "flex-start" }}>
          <Icon name="info" size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
              이 카피는 이전 목표 &lsquo;{prevLabel}&rsquo; 기준이에요
            </div>
            <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "4px 0 0" }}>
              새 목표에 맞게 다시 만드는 걸 추천해요.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                className="btn btn--primary btn--sm"
                type="button"
                onClick={p.onGenerate}
                disabled={p.generating || !p.brand.trim() || !p.target.trim()}
              >
                <Icon name="sparkles" size={12} /> 다시 생성
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => creative.dispatch({ type: "CLEAR_PREVIOUS_OUTCOME" })}
              >
                그대로 둘게요
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="field">
          <label className="field__label">강조하고 싶은 포인트 (선택)</label>
          <input
            className="input"
            value={creative.state.outcomeHint ?? ""}
            onChange={(e) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: e.target.value })}
            placeholder="예) 5월 신상 한정 할인 강조"
          />
        </div>
        <div className="field">
          <label className="field__label">어떤 브랜드·제품을 홍보하나요?</label>
          <textarea
            className="textarea"
            value={p.brand}
            onChange={(e) => p.setBrand(e.target.value)}
            placeholder={"예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'.\n대표 제품은 수분크림으로 자극 없는 성분이 강점이에요."}
          />
        </div>
        <div className="field">
          <label className="field__label">누구에게 보여줄 광고인가요?</label>
          <textarea
            className="textarea"
            value={p.target}
            onChange={(e) => p.setTarget(e.target.value)}
            placeholder="타겟의 직업·나이·관심사·라이프스타일을 적어주세요"
          />
        </div>
        <div className="field">
          <label className="field__label">광고 느낌</label>
          <div className="chips">
            {TONES.map((t) => (
              <button key={t.id} type="button" className={"chip" + (p.tone === t.id ? " chip--on" : "")} onClick={() => p.setTone(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
            <Icon name="sparkles" size={14} style={{ color: "var(--w-accent-violet)" }} /> Gemini로 카피 생성
          </span>
          <button
            className="btn btn--primary"
            type="button"
            onClick={p.onGenerate}
            disabled={p.generating || !p.brand.trim() || !p.target.trim()}
          >
            {p.generating ? (
              <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> 생성 중…</>
            ) : (
              <><Icon name="sparkles" size={14} /> AI 카피 생성하기</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
