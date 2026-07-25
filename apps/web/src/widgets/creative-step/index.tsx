"use client";

// PRD-create-flow-redesign §3.2 — 소재 스튜디오. copy/image phase 전환 폐기, 단일 화면.
// 좌: 피드 프리뷰(sticky, 전 구간 시선 앵커) / 우: 섹션 스택(① 카피 ② 이미지 ③ 다시 만들기).
// page.tsx 는 step 진행·세션스토리지 입력값·generate mutation 결과를 props 로 전달.

import { Button } from "@shared/ui/Button";
import { isStudioDone } from "@entities/creative/brief-flow";
import FeedPreview from "./FeedPreview";
import InputForm from "./InputForm";
import ResultPanel from "./ResultPanel";
import ImagePhase from "./ImagePhase";
import type { CopyHook, OutcomeChip } from "@entities/creative/options";
import type { CreativeAttribution } from "@/lib/gemini-creative";
import type { ProfileNudge } from "@entities/creative/profile-nudge";
interface Props {
  outcome: OutcomeChip | null;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  productId: string | null;
  tone: string;
  setTone: (id: string) => void;
  /** SelectedGoalCard 의 "광고 목표 변경" → 브리프 복귀. page.tsx 가 outcome=null dispatch. */
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
  onBack: () => void;
  onNext: () => void;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
  finalImageDataUrl: string | null;
  setFinalImageDataUrl: (v: string | null) => void;
  /** ADR-052 — 보상 루프 + 귀인. */
  attribution: CreativeAttribution | null;
  nudge: ProfileNudge | null;
  onNudgeAdd: () => void;
  addedLabel: string | null;
  onRegenerate: () => void;
  beforeAfter: { before: string; label: string } | null;
}

export default function CreativeStep(p: Props) {
  const hasImage = !!(p.finalImageDataUrl || p.imageDataUrl);
  const studioDone = isStudioDone(p.outcome, p.generated, hasImage);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 20, alignItems: "flex-start" }}>
      <FeedPreview />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
          attribution={p.attribution}
          nudge={p.nudge}
          onNudgeAdd={p.onNudgeAdd}
          addedLabel={p.addedLabel}
          onRegenerate={p.onRegenerate}
          beforeAfter={p.beforeAfter}
          onGenerate={p.onGenerate}
        />

        <ImagePhase
          productId={p.productId}
          imageDataUrl={p.imageDataUrl}
          setImageDataUrl={p.setImageDataUrl}
          finalImageDataUrl={p.finalImageDataUrl}
          setFinalImageDataUrl={p.setFinalImageDataUrl}
        />

        <InputForm
          personaId={p.personaId}
          setPersonaId={p.setPersonaId}
          productId={p.productId}
          tone={p.tone}
          setTone={p.setTone}
          onChangeOutcome={p.onChangeOutcome}
          generating={p.generating}
          onGenerate={p.onGenerate}
          selectedCopyRefIds={p.selectedCopyRefIds}
          setSelectedCopyRefIds={p.setSelectedCopyRefIds}
          hooks={p.hooks}
          setHooks={p.setHooks}
        />

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" type="button" onClick={p.onBack}>
            ← 브리프
          </Button>
          <div className="flex flex-col items-end gap-1">
            {!studioDone && (
              <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">
                이미지를 만들면 게재로 넘어갈 수 있어요
              </span>
            )}
            <Button variant="primary" type="button" onClick={p.onNext} disabled={!studioDone}>
              게재 설정으로 →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
