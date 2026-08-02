import { useMemo, useState } from "react";
import type { GenerateCreativeResult } from "@/lib/gemini-creative";
import type { CopyHook, OutcomeChip } from "@entities/creative/options";
import type { StudioPhase, StudioSnapshot } from "@entities/creative/draft-persistence";

export function useStudioSession() {
  const [phase, setPhase] = useState<StudioPhase>("compare");
  const [headlines, setHeadlines] = useState<string[] | null>(null);
  const [subtitles, setSubtitles] = useState<string[] | null>(null);
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [primaryTexts, setPrimaryTexts] = useState<[string, string, string] | null>(null);
  const [displayedHooks, setDisplayedHooks] = useState<[CopyHook, CopyHook, CopyHook] | null>(null);
  const [proofPointsCited, setProofPointsCited] = useState<[boolean, boolean, boolean] | null>(null);
  const [primaryTextIdx, setPrimaryTextIdx] = useState(0);
  const [hooks, setHooks] = useState<CopyHook[]>([]);
  const [generatedForOutcome, setGeneratedForOutcome] = useState<OutcomeChip | null>(null);

  const snapshot = useMemo<StudioSnapshot>(() => ({
    phase,
    displayedHeadlines: headlines,
    displayedSubtitles: subtitles,
    headlineIdx,
    displayedPrimaryTexts: primaryTexts,
    displayedHooks,
    proofPointsCited,
    primaryTextIdx,
    hooks,
    generatedForOutcome,
  }), [phase, headlines, subtitles, headlineIdx, primaryTexts, displayedHooks, proofPointsCited, primaryTextIdx, hooks, generatedForOutcome]);

  const restore = (next: StudioSnapshot) => {
    setPhase(next.phase ?? "compare");
    setHeadlines(next.displayedHeadlines);
    setSubtitles(next.displayedSubtitles);
    setHeadlineIdx(next.headlineIdx);
    setPrimaryTexts(next.displayedPrimaryTexts);
    setDisplayedHooks(next.displayedHooks);
    setProofPointsCited(next.proofPointsCited);
    setPrimaryTextIdx(next.primaryTextIdx);
    setHooks(next.hooks);
    setGeneratedForOutcome(next.generatedForOutcome);
  };

  const applyGenerated = (data: GenerateCreativeResult) => {
    setHeadlines(data.headlines);
    setSubtitles(data.subtitles);
    setHeadlineIdx(0);
    setPrimaryTexts(data.primaryTexts);
    setDisplayedHooks(data.hooks);
    setProofPointsCited(data.proofPointsCited ?? null);
    setPrimaryTextIdx(0);
  };

  const selectVersion = (index: number) => {
    setHeadlineIdx(index);
    setPrimaryTextIdx(index);
    return {
      headline: headlines?.[index],
      subtitle: subtitles?.[index],
      primaryText: primaryTexts?.[index],
    };
  };

  const reset = () => {
    setPhase("compare");
    setHeadlines(null);
    setSubtitles(null);
    setHeadlineIdx(0);
    setPrimaryTexts(null);
    setDisplayedHooks(null);
    setProofPointsCited(null);
    setPrimaryTextIdx(0);
    setHooks([]);
    setGeneratedForOutcome(null);
  };

  return {
    phase,
    setPhase,
    headlines,
    subtitles,
    headlineIdx,
    primaryTexts,
    displayedHooks,
    proofPointsCited,
    primaryTextIdx,
    hooks,
    generatedForOutcome,
    snapshot,
    setHooks,
    setHeadlineCandidates: (next: string[]) => {
      setHeadlines(next);
      setHeadlineIdx(0);
    },
    setGeneratedForOutcome,
    restore,
    applyGenerated,
    selectVersion,
    reset,
  };
}
