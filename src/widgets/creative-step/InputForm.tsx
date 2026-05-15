"use client";

// STEP 01 소재 정보 입력 카드 — outcome 칩, 브랜드/타겟/목표 입력, 톤 선택, AI 카피 생성 버튼.

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Select } from "@shared/ui/Select";
import { TONES, OBJECTIVES_PHASE1, OBJECTIVES_PHASE2, type ToneId, type ObjectiveId } from "@entities/creative/options";

const GOAL_OPTIONS = [
  { value: "브랜드 인지도 높이기", label: "브랜드 인지도 높이기" },
  { value: "웹사이트 방문 유도",    label: "웹사이트 방문 유도" },
  { value: "구매 전환",             label: "구매 전환" },
];

interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
  tone: ToneId;
  setTone: (id: ToneId) => void;
  outcomeChips: ObjectiveId[];
  setOutcomeChip: (id: ObjectiveId) => void;
  outcomeHint: string;
  setOutcomeHint: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
}

export default function InputForm(p: Props) {
  return (
    <div className="card card--lg">
      <div className="between" style={{ marginBottom: 4 }}>
        <h2 className="section-title">소재 정보 입력</h2>
        <Badge kind="neutral">필수</Badge>
      </div>
      <p className="section-sub">아래 정보를 토대로 AI가 카피를 만들어요.</p>
      <hr className="divider" />

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* PRD §4 — outcome 칩 (Phase 1 3개) + 자연어 보조. 칩 미선택 시 AI 카피 생성 차단. */}
        <div className="field">
          <label className="field__label">이 광고로 뭘 이루고 싶나요?</label>
          <div className="chips" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", justifyItems: "stretch" }}>
            {OBJECTIVES_PHASE1.map((o) => (
              <button
                key={o.id}
                type="button"
                className={"chip" + (p.outcomeChips.includes(o.id) ? " chip--on" : "")}
                style={{ justifyContent: "center" }}
                onClick={() => p.setOutcomeChip(o.id)}
                title={o.copyTone}
              >
                {o.outcomeLabel}
              </button>
            ))}
            {OBJECTIVES_PHASE2.map((o) => (
              <button
                key={o.id}
                type="button"
                className={"chip" + (p.outcomeChips.includes(o.id) ? " chip--on" : "")}
                style={{ justifyContent: "center" }}
                onClick={() => p.setOutcomeChip(o.id)}
              >
                {o.outcomeLabel}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ marginTop: 10 }}
            value={p.outcomeHint ?? ""}
            onChange={(e) => p.setOutcomeHint(e.target.value)}
            placeholder="강조하고 싶은 포인트나 분위기를 자유롭게 적어주세요"
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
          <label className="field__label">이 광고로 무엇을 얻고 싶나요?</label>
          <Select value={p.goal} onChange={p.setGoal} options={GOAL_OPTIONS} />
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
            disabled={p.generating || p.outcomeChips.length === 0 || !p.brand.trim() || !p.target.trim()}
            title={p.outcomeChips.length === 0 ? "원하는 결과(outcome)를 먼저 골라주세요" : undefined}
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
