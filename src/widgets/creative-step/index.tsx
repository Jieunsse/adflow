"use client";

// STEP 01 소재 작성 widget — ADR-001 §deepening ③.
// 2칼럼 레이아웃 오케스트레이터. 왼쪽 InputForm + 오른쪽 ResultPanel.
// page.tsx 는 step 진행·세션스토리지 입력값·generate mutation 결과를 props 로 전달.
// PRD §13.10 — outcome 선택은 intro 페이지가 담당. STEP 01 은 SelectedGoalCard 만 노출.

import { useState } from "react";
import InputForm from "./InputForm";
import ResultPanel from "./ResultPanel";
import ImagePhase from "./ImagePhase";
import type { CopyHook } from "@entities/creative/options";
import type { CreativeAttribution } from "@/lib/gemini-creative";
import type { ProfileNudge } from "@entities/creative/profile-nudge";
interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  productId: string | null;
  setProductId: (id: string | null) => void;
  tone: string;
  setTone: (id: string) => void;
  /** SelectedGoalCard 의 "광고 목표 변경" → intro 복귀. page.tsx 가 outcome=null dispatch. */
  onChangeOutcome: () => void;
  generating: boolean;
  generated: boolean;
  headlines: string[] | null;
  subtitles: string[] | null;
  subtitle: string;
  setSubtitle: (v: string) => void;
  headlineIdx: number;
  onSelectHeadline: (i: number) => void;
  hooks: CopyHook[];
  setHooks: (hooks: CopyHook[]) => void;
  displayedHooks: [CopyHook, CopyHook, CopyHook] | null;
  proofPointsCited: [boolean, boolean, boolean] | null;
  primaryTexts: [string, string, string] | null;
  primaryTextIdx: number;
  onSelectPrimaryText: (i: number) => void;
  primaryText: string;
  setPrimaryText: (v: string) => void;
  elapsed: number;
  onGenerate: () => void;
  selectedCopyRefIds: string[];
  setSelectedCopyRefIds: (ids: string[]) => void;
  onSaveToLibrary: () => void;
  saved: boolean;
  goLibrary: () => void;
  onNext: () => void;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
  finalImageDataUrl: string | null;
  setFinalImageDataUrl: (v: string | null) => void;
  /** ADR-052 — 보상 루프 + 귀인 + 브랜드 override. */
  customBrand: boolean;
  setCustomBrand: (v: boolean) => void;
  attribution: CreativeAttribution | null;
  nudge: ProfileNudge | null;
  onNudgeAdd: () => void;
  addedLabel: string | null;
  onRegenerate: () => void;
  beforeAfter: { before: string; label: string } | null;
}

export default function CreativeStep(p: Props) {
  // ADR-040 — 소재 만들기 내부 2-phase. 최상위 Stepper(STEP 02=집행)와 독립.
  const [phase, setPhase] = useState<"copy" | "image">("copy");

  if (phase === "image") {
    return (
      <ImagePhase
        productId={p.productId}
        imageDataUrl={p.imageDataUrl}
        setImageDataUrl={p.setImageDataUrl}
        finalImageDataUrl={p.finalImageDataUrl}
        setFinalImageDataUrl={p.setFinalImageDataUrl}
        onBackToCopy={() => setPhase("copy")}
        onNext={p.onNext}
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "flex-start" }}>
      <InputForm
        brand={p.brand}
        setBrand={p.setBrand}
        target={p.target}
        setTarget={p.setTarget}
        personaId={p.personaId}
        setPersonaId={p.setPersonaId}
        productId={p.productId}
        setProductId={p.setProductId}
        tone={p.tone}
        setTone={p.setTone}
        onChangeOutcome={p.onChangeOutcome}
        generating={p.generating}
        onGenerate={p.onGenerate}
        selectedCopyRefIds={p.selectedCopyRefIds}
        setSelectedCopyRefIds={p.setSelectedCopyRefIds}
        hooks={p.hooks}
        setHooks={p.setHooks}
        customBrand={p.customBrand}
        setCustomBrand={p.setCustomBrand}
      />
      <ResultPanel
        generating={p.generating}
        generated={p.generated}
        headlines={p.headlines}
        subtitles={p.subtitles}
        subtitle={p.subtitle}
        setSubtitle={p.setSubtitle}
        headlineIdx={p.headlineIdx}
        onSelectHeadline={p.onSelectHeadline}
        primaryTexts={p.primaryTexts}
        primaryTextIdx={p.primaryTextIdx}
        onSelectPrimaryText={p.onSelectPrimaryText}
        displayedHooks={p.displayedHooks}
        proofPointsCited={p.proofPointsCited}
        primaryText={p.primaryText}
        setPrimaryText={p.setPrimaryText}
        elapsed={p.elapsed}
        onSaveToLibrary={p.onSaveToLibrary}
        saved={p.saved}
        goLibrary={p.goLibrary}
        onGoImage={() => setPhase("image")}
        attribution={p.attribution}
        nudge={p.nudge}
        onNudgeAdd={p.onNudgeAdd}
        addedLabel={p.addedLabel}
        onRegenerate={p.onRegenerate}
        beforeAfter={p.beforeAfter}
      />
    </div>
  );
}
