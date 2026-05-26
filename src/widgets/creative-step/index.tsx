"use client";

// STEP 01 소재 작성 widget — ADR-001 §deepening ③.
// 2칼럼 레이아웃 오케스트레이터. 왼쪽 InputForm + 오른쪽 ResultPanel.
// page.tsx 는 step 진행·세션스토리지 입력값·generate mutation 결과를 props 로 전달.
// PRD §13.10 — outcome 선택은 intro 페이지가 담당. STEP 01 은 SelectedGoalCard 만 노출.

import { type ToneId } from "@entities/creative/options";
import InputForm from "./InputForm";
import ResultPanel from "./ResultPanel";

interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  tone: ToneId;
  setTone: (id: ToneId) => void;
  /** SelectedGoalCard 의 "광고 목표 변경" → intro 복귀. page.tsx 가 outcome=null dispatch. */
  onChangeOutcome: () => void;
  generating: boolean;
  generated: boolean;
  headlines: string[] | null;
  headlineIdx: number;
  onSelectHeadline: (i: number) => void;
  primaryTexts: [string, string, string] | null;
  primaryTextIdx: number;
  onSelectPrimaryText: (i: number) => void;
  primaryText: string;
  setPrimaryText: (v: string) => void;
  elapsed: number;
  onGenerate: () => void;
  onSaveToLibrary: () => void;
  saved: boolean;
  goLibrary: () => void;
  onNext: () => void;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
}

export default function CreativeStep(p: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "flex-start" }}>
      <InputForm
        brand={p.brand}
        setBrand={p.setBrand}
        target={p.target}
        setTarget={p.setTarget}
        personaId={p.personaId}
        setPersonaId={p.setPersonaId}
        tone={p.tone}
        setTone={p.setTone}
        onChangeOutcome={p.onChangeOutcome}
        generating={p.generating}
        onGenerate={p.onGenerate}
      />
      <ResultPanel
        generating={p.generating}
        generated={p.generated}
        headlines={p.headlines}
        headlineIdx={p.headlineIdx}
        onSelectHeadline={p.onSelectHeadline}
        primaryTexts={p.primaryTexts}
        primaryTextIdx={p.primaryTextIdx}
        onSelectPrimaryText={p.onSelectPrimaryText}
        primaryText={p.primaryText}
        setPrimaryText={p.setPrimaryText}
        elapsed={p.elapsed}
        onSaveToLibrary={p.onSaveToLibrary}
        saved={p.saved}
        goLibrary={p.goLibrary}
        onNext={p.onNext}
        imageDataUrl={p.imageDataUrl}
        setImageDataUrl={p.setImageDataUrl}
      />
    </div>
  );
}
