"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@shared/ui/primitives";
import { useSessionStorage } from "@shared/lib/storage/useSessionStorage";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import type { GenerateCreativeParams, GenerateCreativeResult } from "@/lib/gemini-creative";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";
import { useToast } from "@shared/ui/Toast";
import { useLibrary } from "@shared/lib/library";
import { TONES, CTAS, type ToneId, type CtaId } from "@entities/creative/options";
import Stepper from "./_components/Stepper";
import CreativeStep from "@widgets/creative-step";
import LaunchStep from "@widgets/launch-step";
import PerformanceStep from "@widgets/performance-step";
import { autoModeFromObjective } from "@features/switch-mode/objective-routing";

const GRADIENTS = [
  "linear-gradient(135deg, #0066ff 0%, #6541f2 60%, #00bdde 100%)",
  "linear-gradient(135deg, #ff7a59 0%, #ffb24d 55%, #ffd966 100%)",
  "linear-gradient(135deg, #2c3e50 0%, #4a5d6f 60%, #6e8aa6 100%)",
  "linear-gradient(135deg, #6541f2 0%, #c2185b 60%, #ff7a59 100%)",
];

const TITLES = ["AI로 소재를 만들어 봐요", "어떻게 집행할지 정해 봐요", "성과를 확인해 봐요"];
const SUBS = [
  "제품과 타겟 정보를 알려주세요. Gemini가 카피·헤드라인·타겟팅을 제안해 드려요.",
  "예산, 기간, 타겟을 확인하고 Meta에 광고를 집행하세요.",
  "노출·클릭·CTR·지출을 한눈에 확인하고, 다음 단계를 결정하세요.",
];

export default function CreatePage() {
  const router = useRouter();
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const showToast = useToast();
  const library = useLibrary();

  const [step, setStep] = useState(0);

  const [brand, setBrand] = useSessionStorage("adflow_brand", "");
  const [target, setTarget] = useSessionStorage("adflow_target", "");
  const [goal, setGoal] = useSessionStorage("adflow_goal", "");
  const [displayedHeadlines, setDisplayedHeadlines] = useState<string[] | null>(null);
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const generateMutation = useApiMutation<GenerateCreativeParams, GenerateCreativeResult>('/api/generate-creative');
  const generating = generateMutation.isPending;
  const generated = displayedHeadlines !== null;

  const launched = launch.state.launchedCampaign;

  useEffect(() => {
    setSavedId(null);
  }, [displayedHeadlines, headlineIdx, creative.state.primaryText, creative.state.cta]);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("adflow_loaded_creative"); } catch { /* sessionStorage 사용 불가 */ }
    if (!raw) return;
    try { sessionStorage.removeItem("adflow_loaded_creative"); } catch { /* 무시 */ }
    let loaded: { headline?: string; primary?: string; ctaId?: string; tone?: string };
    try { loaded = JSON.parse(raw) as typeof loaded; } catch { return; }
    if (!loaded.headline) return;
    setDisplayedHeadlines([loaded.headline]);
    setHeadlineIdx(0);
    creative.dispatch({ type: "SET_HEADLINE", headline: loaded.headline });
    if (loaded.primary != null) creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: loaded.primary });

    if (loaded.tone && TONES.some((t) => t.id === loaded.tone)) creative.dispatch({ type: "SET_TONE", tone: loaded.tone as ToneId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = () => {
    if (creative.state.outcomeChips.length === 0) {
      showToast("원하는 결과(outcome)를 먼저 골라주세요");
      return;
    }
    const startedAt = Date.now();
    generateMutation.mutate(
      { brand, target, goal, tone: creative.state.tone, outcome: creative.state.outcomeChips[0], hint: creative.state.outcomeHint },
      {
        onSuccess: (data) => {
          setDisplayedHeadlines(data.headlines);
          setHeadlineIdx(0);
          creative.dispatch({ type: "SET_HEADLINE", headline: data.headlines[0] });
          creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: data.primaryText });
          creative.dispatch({ type: "SET_TARGETING", targeting: data.targeting });
          setElapsed(Math.round((Date.now() - startedAt) / 100) / 10);
        },
        onError: (err) => {
          console.error("[generate-creative]", err);
          showToast("카피 생성에 실패했어요, 다시 시도해주세요");
        },
      },
    );
  };

  const handleSelectHeadline = (i: number) => {
    setHeadlineIdx(i);
    if (displayedHeadlines) creative.dispatch({ type: "SET_HEADLINE", headline: displayedHeadlines[i] });
  };

  const handleSaveToLibrary = () => {
    if (!displayedHeadlines) return;
    const toneLabel = TONES.find((t) => t.id === creative.state.tone)?.label ?? creative.state.tone;
    const ctaLabel = CTAS.find((c) => c.id === creative.state.cta)?.label ?? creative.state.cta;
    const id = library.save({
      brand,
      headline: displayedHeadlines[headlineIdx],
      primary: creative.state.primaryText,
      tone: creative.state.tone,
      toneLabel,
      ctaId: creative.state.cta,
      ctaLabel,
      goal,
      target,
      gradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
      tag: "AI 생성",
    });
    setSavedId(id);
  };

  const handleRestart = () => {
    creative.dispatch({ type: "RESET" });
    launch.dispatch({ type: "RESET" });
    generateMutation.reset();
    setDisplayedHeadlines(null);
    setHeadlineIdx(0);
    setSavedId(null);
    setElapsed(0);
    setStep(0);
  };

  const completed = [generated, !!launched, false];
  // STEP 03 은 Meta App 개발 모드(skipped) 로 만든 캠페인엔 KPI 가 없어서 진입 차단
  const stepValid: [boolean, boolean] = [true, !launched?.skipped];

  return (
    <div className="page" data-screen-label="광고 만들기">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>광고 만들기</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>{TITLES[step]}</h1>
          <p className="page__sub">{SUBS[step]}</p>
        </div>
        <div>
          <Badge kind="violet" dot>DRAFT · {String(step + 1).padStart(2, "0")}</Badge>
        </div>
      </div>

      <Stepper step={step} setStep={setStep} completed={completed} stepValid={stepValid} />

      {step === 0 && (
        <CreativeStep
          brand={brand}
          setBrand={setBrand}
          target={target}
          setTarget={setTarget}
          goal={goal}
          setGoal={setGoal}
          tone={creative.state.tone}
          setTone={(id: ToneId) => creative.dispatch({ type: "SET_TONE", tone: id })}
          outcomeChips={creative.state.outcomeChips}
          setOutcomeChip={(id) => creative.dispatch({ type: "SET_OUTCOME_CHIP", chip: id })}
          outcomeHint={creative.state.outcomeHint}
          setOutcomeHint={(v) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: v })}
          generating={generating}
          generated={generated}
          headlines={displayedHeadlines}
          headlineIdx={headlineIdx}
          onSelectHeadline={handleSelectHeadline}
          primaryText={creative.state.primaryText}
          setPrimaryText={(v: string) => creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: v })}
          elapsed={elapsed}
          onGenerate={handleGenerate}
          onSaveToLibrary={handleSaveToLibrary}
          saved={!!savedId}
          goLibrary={() => router.push("/library")}
          onNext={() => {
            const autoMode = autoModeFromObjective(creative.state.objective);
            if (autoMode) launch.dispatch({ type: "SET_MODE", mode: autoMode });
            setStep(1);
          }}
          imageDataUrl={launch.state.imageDataUrl}
          setImageDataUrl={(v) => launch.dispatch({ type: "SET_IMAGE_DATA_URL", value: v })}
        />
      )}

      {step === 1 && (
        <LaunchStep
          onNext={() => setStep(2)}
          goSettings={() => router.push("/setup")}
          goCreative={() => setStep(0)}
        />
      )}

      {step === 2 && <PerformanceStep onRestart={handleRestart} />}
    </div>
  );
}
