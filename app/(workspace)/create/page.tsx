"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@shared/ui/primitives";
import { useSessionStorage } from "@shared/lib/storage/useSessionStorage";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import type { GenerateCreativeParams, GenerateCreativeResult } from "@/lib/gemini-creative";
import { INITIAL_CREATIVE_STATE, useCreativeDraft } from "@entities/creative/model";
import { abVariantLabel, INITIAL_LAUNCH_STATE, useLaunchDraft, type AbTestAxis } from "@entities/campaign/model";
import { loadLaunchedCampaign } from "@entities/campaign/launched-storage";
import { judgeAbTest, rowToKpi } from "@entities/insights/ab-verdict";
import { getMockCampaign, getMockCampaignAdIds, seedMockAdRows } from "@/lib/mock-campaigns";
import Icon from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import { useLibrary } from "@shared/lib/library";
import { TONES, CTAS, OBJECTIVES_ALL, type ToneId, type CtaId } from "@entities/creative/options";
import Stepper from "./_components/Stepper";
import GoalIntro from "@widgets/goal-intro";
import CreativeStep from "@widgets/creative-step";
import LaunchStep from "@widgets/launch-step";
import PostLaunchChecklist from "@widgets/post-launch-checklist";
import { autoModeFromObjective } from "@features/switch-mode/objective-routing";

const GRADIENTS = [
  "linear-gradient(135deg, #0066ff 0%, #6541f2 60%, #00bdde 100%)",
  "linear-gradient(135deg, #ff7a59 0%, #ffb24d 55%, #ffd966 100%)",
  "linear-gradient(135deg, #2c3e50 0%, #4a5d6f 60%, #6e8aa6 100%)",
  "linear-gradient(135deg, #6541f2 0%, #c2185b 60%, #ff7a59 100%)",
];

const DEMO_BRAND = "예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'.\n대표 제품은 수분크림으로 자극 없는 성분이 강점이에요.";
const DEMO_TARGET = "타겟의 직업·나이·관심사·라이프스타일을 적어주세요";
const DEMO_OUTCOME_HINT = "신제품 홍보 및 신제품 특별할인";

const TITLES = ["AI로 소재를 만들어 봐요", "어떻게 집행할지 정해 봐요", "마무리 점검을 해봐요"];
const SUBS = [
  "제품과 타겟 정보를 알려주세요. Gemini가 카피·헤드라인·타겟팅을 제안해 드려요.",
  "예산, 기간, 타겟을 확인하고 Meta에 광고를 집행하세요.",
  "광고를 정상적으로 생성했어요. 결과를 받기 전에 최종적으로 점검해봐요.",
];

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const showToast = useToast();
  const library = useLibrary();

  const [step, setStep] = useState(0);
  // PRD §13.10.6 — intro 진입 완료 여부. 카드 클릭만으로 자동 진입 안 함. "다음" 버튼 클릭 시 true.
  const [introCompleted, setIntroCompleted] = useState(false);

  // PRD-ab-testing.md §3.3 / §8 — `?prefill=campaign:{id}` 진입 → 우세 안 자동 채움.
  const prefillRaw = searchParams.get("prefill");
  const prefillCampaignId = prefillRaw?.startsWith("campaign:") ? prefillRaw.slice("campaign:".length) : null;
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null);
  const [prefillHandled, setPrefillHandled] = useState(false);

  useEffect(() => {
    if (prefillHandled || !prefillCampaignId) return;
    setPrefillHandled(true);

    // PRD-ab-testing.md §8.2 v0.2 Q7 — 진행 중 작업 가드. reference equality 로 dispatch 발생 여부 판정.
    const inProgress = creative.state !== INITIAL_CREATIVE_STATE || launch.state !== INITIAL_LAUNCH_STATE;
    if (inProgress) {
      const overwrite = window.confirm(
        "작업 중인 캠페인이 있어요. 이전 캠페인의 우세 안으로 덮어쓸까요?\n\n[확인] 덮어쓰기\n[취소] 이전 캠페인은 다음에 (지금 작업 유지)",
      );
      if (!overwrite) {
        router.replace("/create");
        return;
      }
    }

    // launched-storage(사용자 생성) → mock 시연 entry 순으로 A/B 정보 도출.
    const launched = loadLaunchedCampaign(prefillCampaignId);
    const mock = !launched ? getMockCampaign(prefillCampaignId) : null;

    let axis: AbTestAxis | undefined;
    let variantA: string | undefined;
    let variantB: string | undefined;
    let adIds: [string, string] | null = null;
    let startDate: string | null = null;

    if (launched?.abTestAxis && launched.abTestVariantA && launched.abTestVariantB && launched.adIds && launched.startDate) {
      axis = launched.abTestAxis;
      variantA = launched.abTestVariantA;
      variantB = abVariantLabel(launched.abTestVariantB);
      adIds = launched.adIds;
      startDate = launched.startDate;
    } else if (mock?.abTestEnabled && mock.abTestAxis && mock.abTestVariantA && mock.abTestVariantB && mock.startDate) {
      axis = mock.abTestAxis;
      variantA = mock.abTestVariantA;
      variantB = mock.abTestVariantB;
      adIds = getMockCampaignAdIds(prefillCampaignId);
      startDate = mock.startDate;
    }

    router.replace("/create");
    if (!axis || axis !== "headline" || !variantA || !variantB || !adIds || !startDate) return;

    // PRD-ab-testing.md §8.2 4단계 — winner 'B' 면 variantB, 'A' 면 variantA. 그 외는 prefill 안 함.
    const ads = seedMockAdRows(prefillCampaignId, startDate, adIds);
    const verdict = judgeAbTest(rowToKpi(ads[0]), rowToKpi(ads[1]));
    if (verdict.state !== "winner") return;
    const winnerText = verdict.winner === "B" ? variantB : variantA;
    const winnerLabel = verdict.winner === "B" ? "B안" : "A안";

    creative.dispatch({ type: "RESET" });
    launch.dispatch({ type: "RESET" });
    creative.dispatch({ type: "SET_HEADLINE", headline: winnerText });
    setIntroCompleted(true);
    setStep(0);
    setPrefillBanner(`이전 캠페인의 우세 안(${winnerLabel})을 기본으로 채웠어요. 이번엔 다른 축으로 A/B 해볼까요?`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCampaignId, prefillHandled]);

  const [brand, setBrand] = useSessionStorage("adflow_brand", "");
  const [target, setTarget] = useSessionStorage("adflow_target", "");
  const [displayedHeadlines, setDisplayedHeadlines] = useState<string[] | null>(null);
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [displayedPrimaryTexts, setDisplayedPrimaryTexts] = useState<[string, string, string] | null>(null);
  const [primaryTextIdx, setPrimaryTextIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const generateMutation = useApiMutation<GenerateCreativeParams, GenerateCreativeResult>('/api/generate-creative');
  const generating = generateMutation.isPending;
  const generated = displayedHeadlines !== null;

  const launched = launch.state.launchedCampaign;

  useEffect(() => {
    setSavedId(null);
  }, [displayedHeadlines, headlineIdx, creative.state.primaryText, creative.state.cta]);

  // 둘러보기 모드 1회 자동 시드 — 비어있는 입력값에만 placeholder 텍스트를 채워 데모 진입을 매끄럽게.
  useEffect(() => {
    if (status !== "authenticated" || !session?.browseMode) return;
    let seeded: string | null = null;
    try { seeded = sessionStorage.getItem("adflow_demo_seeded"); } catch { /* sessionStorage 사용 불가 */ }
    if (seeded === "1") return;
    try { sessionStorage.setItem("adflow_demo_seeded", "1"); } catch { /* 무시 */ }
    let storedBrand: string | null = null;
    let storedTarget: string | null = null;
    try {
      storedBrand = sessionStorage.getItem("adflow_brand");
      storedTarget = sessionStorage.getItem("adflow_target");
    } catch { /* 무시 */ }
    if (!storedBrand) setBrand(DEMO_BRAND);
    if (!storedTarget) setTarget(DEMO_TARGET);
    if (!creative.state.outcomeHint) creative.dispatch({ type: "SET_OUTCOME_HINT", hint: DEMO_OUTCOME_HINT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.browseMode]);

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
    if (!creative.state.outcome) {
      showToast("원하는 결과(outcome)를 먼저 골라주세요");
      return;
    }
    const startedAt = Date.now();
    generateMutation.mutate(
      { brand, target, tone: creative.state.tone, outcome: creative.state.outcome, hint: creative.state.outcomeHint },
      {
        onSuccess: (data) => {
          setDisplayedHeadlines(data.headlines);
          setHeadlineIdx(0);
          setDisplayedPrimaryTexts(data.primaryTexts);
          setPrimaryTextIdx(0);
          creative.dispatch({ type: "SET_HEADLINE", headline: data.headlines[0] });
          // PRD §5.4.2 (5) — STEP 02 디테일 A/B 시험 B안 풀로 사용. 재생성 시 후보 교체 → DetailKnobs 의 sync useEffect 가 B안 reset.
          creative.dispatch({ type: "SET_HEADLINE_CANDIDATES", candidates: data.headlines });
          creative.dispatch({ type: "SET_PRIMARY_TEXT_CANDIDATES", candidates: data.primaryTexts });
          creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: data.primaryTexts[0] });
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

  const handleSelectPrimaryText = (i: number) => {
    setPrimaryTextIdx(i);
    if (displayedPrimaryTexts) creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: displayedPrimaryTexts[i] });
  };

  const handleSaveToLibrary = () => {
    if (!displayedHeadlines) return;
    const toneLabel = TONES.find((t) => t.id === creative.state.tone)?.label ?? creative.state.tone;
    const ctaLabel = CTAS.find((c) => c.id === creative.state.cta)?.label ?? creative.state.cta;
    // PRD §13.10 — Goal Select 폐기. 라이브러리 goal 칼럼은 outcome 칩 의 outcomeLabel 로 채워 호환 유지.
    const goalLabel = creative.state.outcome
      ? OBJECTIVES_ALL.find((o) => o.id === creative.state.outcome)?.outcomeLabel ?? ""
      : "";
    const id = library.save({
      brand,
      headline: displayedHeadlines[headlineIdx],
      primary: creative.state.primaryText,
      tone: creative.state.tone,
      toneLabel,
      ctaId: creative.state.cta,
      ctaLabel,
      goal: goalLabel,
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
    setDisplayedPrimaryTexts(null);
    setPrimaryTextIdx(0);
    setSavedId(null);
    setElapsed(0);
    setStep(0);
    setIntroCompleted(false);
  };

  // PRD §13.10.6 — 광고 목표 변경 = intro 로 복귀. STEP 01·STEP 02 의 SelectedGoalCard 둘 다 사용.
  const handleChangeOutcome = () => {
    creative.dispatch({ type: "SET_OUTCOME", outcome: null });
    setIntroCompleted(false);
    setStep(0);
  };

  const completed = [generated, !!launched, false];
  // PRD-ab-testing.md §2.1 v0.2 Q4 — skipped + A/B 면 mock 시드된 결과 카드 까지 보여줘야 하므로 진입 허용.
  // skipped 인데 A/B 도 아니면 KPI 가 0 이라 단순 예시 모드로 동작.
  const stepValid: [boolean, boolean] = [true, true];

  // PRD §13.10.6 — intro 완료 여부로 분기. 카드 클릭만으론 자동 진입 안 함, "다음" 버튼이 명시적 commit.
  const showIntro = !introCompleted;

  return (
    <div className="page" data-screen-label="광고 만들기">
      {/* PRD §13.10.5 — /create 흐름 전체에 line-free 디자인. 카드는 shadow only, divider 숨김, input/textarea filled. */}
      <style>{`
        [data-screen-label="광고 만들기"] .card {
          border: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
        }
        [data-screen-label="광고 만들기"] .divider { display: none; }
        [data-screen-label="광고 만들기"] .input,
        [data-screen-label="광고 만들기"] .textarea {
          background: rgba(0,0,0,0.04);
          border: 0;
        }
        [data-screen-label="광고 만들기"] .input:focus,
        [data-screen-label="광고 만들기"] .textarea:focus {
          background: rgba(0,0,0,0.06);
          outline: 2px solid var(--w-primary-soft);
          outline-offset: -2px;
        }
        [data-screen-label="광고 만들기"] .goal-card {
          /* 비활성 카드 — 보더는 투명 placeholder (활성 시 violet 로 바뀌어도 size shift 없음) */
          border: 1.5px solid transparent;
          background: var(--w-bg-normal);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
        }
        [data-screen-label="광고 만들기"] .goal-card:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.06), 0 10px 24px rgba(0,0,0,0.08);
        }
        [data-screen-label="광고 만들기"] .goal-card--active {
          /* 활성 카드 — violet 보더 + 미묘한 violet bg + 부드러운 후광 ring */
          border-color: var(--w-accent-violet);
          background: rgba(101,65,242,0.025);
          box-shadow: 0 0 0 3px rgba(101,65,242,0.08), 0 6px 18px rgba(101,65,242,0.12);
        }
        [data-screen-label="광고 만들기"] .goal-card:not(:disabled):hover.goal-card--active {
          box-shadow: 0 0 0 3px rgba(101,65,242,0.12), 0 8px 22px rgba(101,65,242,0.16);
        }
      `}</style>
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>광고 만들기</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>
            {showIntro ? "광고 목표를 골라주세요" : TITLES[step]}
          </h1>
          <p className="page__sub">
            {showIntro ? "어떤 광고를 만들지 먼저 결정해주세요. 카피·캠페인 설정이 자동으로 맞춰져요." : SUBS[step]}
          </p>
        </div>
        <div>
          <Badge kind="violet" dot>DRAFT · {showIntro ? "00" : String(step + 1).padStart(2, "0")}</Badge>
        </div>
      </div>

      {prefillBanner && (
        <div
          className="callout"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 14,
            marginBottom: 16,
            background: "var(--w-primary-soft)",
            borderRadius: 12,
          }}
        >
          <Icon name="sparkles" size={16} />
          <p style={{ flex: 1, font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: 0 }}>
            {prefillBanner}
          </p>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => {
              creative.dispatch({ type: "RESET" });
              launch.dispatch({ type: "RESET" });
              setPrefillBanner(null);
            }}
          >
            지우고 새로 시작
          </button>
        </div>
      )}

      {showIntro ? (
        <GoalIntro onNext={() => { setIntroCompleted(true); setStep(0); }} />
      ) : (
        <>
          <Stepper step={step} setStep={setStep} completed={completed} stepValid={stepValid} />

          {step === 0 && (
            <CreativeStep
              brand={brand}
              setBrand={setBrand}
              target={target}
              setTarget={setTarget}
              tone={creative.state.tone}
              setTone={(id: ToneId) => creative.dispatch({ type: "SET_TONE", tone: id })}
              onChangeOutcome={handleChangeOutcome}
              generating={generating}
              generated={generated}
              headlines={displayedHeadlines}
              headlineIdx={headlineIdx}
              onSelectHeadline={handleSelectHeadline}
              primaryTexts={displayedPrimaryTexts}
              primaryTextIdx={primaryTextIdx}
              onSelectPrimaryText={handleSelectPrimaryText}
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
              goCreative={handleChangeOutcome}
            />
          )}

          {step === 2 && <PostLaunchChecklist onRestart={handleRestart} />}
        </>
      )}
    </div>
  );
}
