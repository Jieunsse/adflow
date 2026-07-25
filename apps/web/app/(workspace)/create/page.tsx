"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { useSessionStorage } from "@shared/lib/storage/useSessionStorage";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import type { GenerateCreativeParams, GenerateCreativeResult, CreativeAttribution } from "@/lib/gemini-creative";
import { INITIAL_CREATIVE_STATE, useCreativeDraft } from "@entities/creative/model";
import { abVariantLabel, INITIAL_LAUNCH_STATE, useLaunchDraft, type AbTestAxis } from "@entities/campaign/model";
import { loadLaunchedCampaign } from "@entities/campaign/launched-storage";
import { judgeAbTest, rowToKpi, type AdKpi } from "@entities/insights/ab-verdict";
import type { AdInsightsRow } from "@entities/insights/types";
import { tournamentClient } from "@entities/ab-test/tournament/client";
import { getMockCampaign, getMockCampaignAdIds, seedMockAdRows } from "@/lib/mock-campaigns";
import Icon from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import { useLibrary } from "@shared/lib/library";
import ConfirmModal from "@shared/ui/ConfirmModal";
import { TONES, CTAS, OBJECTIVES_ALL, COPY_HOOKS, type CtaId, type CopyHook, type OutcomeChip } from "@entities/creative/options";
import { isBoost } from "@entities/creative/outcome-routing";
import { nextStepAfterBrief, shouldTriggerGenerate, isBriefDone, isStudioDone } from "@entities/creative/brief-flow";
import {
  saveDraftToSession,
  loadDraftFromSession,
  clearDraftFromSession,
  hydrateCreativeDraft,
  hydrateLaunchDraft,
  type CreateDraftSnapshot,
} from "@entities/creative/draft-persistence";
import { shrinkImageDataUrl } from "@shared/lib/shrink-image";
import Stepper from "./_components/Stepper";
import GoalIntro from "@widgets/goal-intro";
import CreativeStep from "@widgets/creative-step";
import LaunchStep from "@widgets/launch-step";
import { readBrandProfile, readActiveBrandProfileEntry, useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { readPersonas, usePersonasStorage } from "@features/brand-profile/model/usePersonasStorage";
import { mergePersonaTargeting } from "@features/brand-profile/model/mergePersonaTargeting";
import { useProducts } from "@shared/lib/products";
import PersonaQuickCreateModal from "@features/brand-profile/ui/PersonaQuickCreateModal";
import ProductEditModal from "@features/brand-profile/ui/ProductEditModal";
import { selectProfileNudge, NUDGE_LABEL, type ProfileNudge, type ProfileNudgeTarget } from "@entities/creative/profile-nudge";

const GRADIENTS = [
  "linear-gradient(135deg, #0066ff 0%, #6541f2 60%, #00bdde 100%)",
  "linear-gradient(135deg, #ff7a59 0%, #ffb24d 55%, #ffd966 100%)",
  "linear-gradient(135deg, #2c3e50 0%, #4a5d6f 60%, #6e8aa6 100%)",
  "linear-gradient(135deg, #6541f2 0%, #c2185b 60%, #ff7a59 100%)",
];

const DEMO_BRAND = "예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'.\n대표 제품은 수분크림으로 자극 없는 성분이 강점이에요.";
const DEMO_TARGET = "타겟의 직업·나이·관심사·라이프스타일을 적어주세요";
const DEMO_OUTCOME_HINT = "신제품 홍보 및 신제품 특별할인";

// PRD-create-flow-redesign §3 — step: 0 브리프 · 1 소재 스튜디오 · 2 게재 계획(게재 완료 상태 포함).
const TITLES = ["광고 목표를 골라주세요", "AI로 소재를 만들어 봐요", "게재 계획을 확인해주세요"];
const SUBS = [
  "목표에 맞춰 AI 카피와 캠페인 설정이 자동으로 준비돼요.",
  "제품과 타겟 정보를 알려주세요. Gemini가 카피·헤드라인·타겟팅을 제안해 드려요.",
  "AI가 채운 계획서예요. 확인하고 바로 Meta에 광고를 집행하세요.",
];

function CreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const showToast = useToast();
  const library = useLibrary();
  // generate-first(PRD-create-flow-redesign §3.1) — 브리프에서 이 outcome 으로 이미 생성했는지 추적.
  const generatedForOutcomeRef = useRef<OutcomeChip | null>(null);

  // PRD-create-flow-redesign §3 — 0 브리프 · 1 소재 스튜디오 · 2 게재 계획 · 3 게재 완료(과도기).
  const [step, setStep] = useState(0);

  // PRD-ab-testing.md §3.3 / §8 — `?prefill=campaign:{id}` 진입 → 우세 안 자동 채움.
  const prefillRaw = searchParams.get("prefill");
  const prefillCampaignId = prefillRaw?.startsWith("campaign:") ? prefillRaw.slice("campaign:".length) : null;
  // 토너먼트 승자 승격 — `?prefill=tournament:{id}` 진입 → 챔피언 크리에이티브 자동 채움.
  const prefillTournamentId = prefillRaw?.startsWith("tournament:") ? prefillRaw.slice("tournament:".length) : null;
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null);
  const [prefillHandled, setPrefillHandled] = useState(false);
  const [tournamentPrefillHandled, setTournamentPrefillHandled] = useState(false);
  // window.confirm 대체 — 진행 중 작업 덮어쓰기 확인을 ConfirmModal 로 처리(campaigns/[id] 패턴).
  const [pendingPrefill, setPendingPrefill] = useState<{ kind: "campaign" | "tournament"; id: string } | null>(null);

  // ChannelInsights AI 제안 → /create 진입. outcome·outcomeHint prefill 후 intro 자동 통과.
  const channelInsightsFrom = searchParams.get("from") === "channel-insights";
  const channelInsightsOutcome = searchParams.get("outcome");
  const channelInsightsHint = searchParams.get("outcomeHint");
  const channelInsightsIgMediaId = searchParams.get("igMediaId");
  const [channelInsightsHandled, setChannelInsightsHandled] = useState(false);
  useEffect(() => {
    if (channelInsightsHandled || !channelInsightsFrom) return;
    setChannelInsightsHandled(true);
    if (channelInsightsOutcome && OBJECTIVES_ALL.some((o) => o.id === channelInsightsOutcome)) {
      creative.dispatch({ type: "SET_OUTCOME", outcome: channelInsightsOutcome as (typeof OBJECTIVES_ALL)[number]["id"] });
      setStep(isBoost(channelInsightsOutcome as (typeof OBJECTIVES_ALL)[number]["id"]) ? 2 : 1);
    }
    if (channelInsightsHint) {
      creative.dispatch({ type: "SET_OUTCOME_HINT", hint: channelInsightsHint });
    }
    // boost_post 게시물 프리셀렉트 — router.replace 로 쿼리가 사라지기 전에 BoostPostFlow 가 읽을 자리에 보관.
    if (channelInsightsIgMediaId) {
      try { sessionStorage.setItem("adflow_boost_igmedia_preselect", channelInsightsIgMediaId); } catch { /* 무시 */ }
    }
    router.replace("/create");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelInsightsHandled, channelInsightsFrom]);

  const [brand, setBrand] = useSessionStorage("adflow_brand", "");
  const [target, setTarget] = useSessionStorage("adflow_target", "");
  const [personaIdRaw, setPersonaIdRaw] = useSessionStorage("adflow_personaId", "");
  const personaId = personaIdRaw || null;
  const setPersonaId = (id: string | null) => setPersonaIdRaw(id ?? "");
  const [productIdRaw, setProductIdRaw] = useSessionStorage("adflow_productId", "");
  const productId = productIdRaw || null;
  const setProductId = (id: string | null) => setProductIdRaw(id ?? "");
  const [selectedCopyRefIds, setSelectedCopyRefIds] = useState<string[]>([]);
  // 카피 훅 (ADR-029) — outcome 추천 풀이 기본값. 디테일 유저가 InputForm 에서 교체 가능.
  const [hooks, setHooks] = useState<CopyHook[]>([]);
  const [displayedHeadlines, setDisplayedHeadlines] = useState<string[] | null>(null);
  const [displayedSubtitles, setDisplayedSubtitles] = useState<string[] | null>(null);
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [displayedPrimaryTexts, setDisplayedPrimaryTexts] = useState<[string, string, string] | null>(null);
  const [displayedHooks, setDisplayedHooks] = useState<[CopyHook, CopyHook, CopyHook] | null>(null);
  const [proofPointsCited, setProofPointsCited] = useState<[boolean, boolean, boolean] | null>(null);
  const [primaryTextIdx, setPrimaryTextIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  // ADR-052 — 보상 루프 상태.
  const [customBrand, setCustomBrand] = useState(false);
  const [attribution, setAttribution] = useState<CreativeAttribution | null>(null);
  const [nudge, setNudge] = useState<ProfileNudge | null>(null);
  const [addedTarget, setAddedTarget] = useState<ProfileNudgeTarget | null>(null);
  const [beforeAfter, setBeforeAfter] = useState<{ before: string; label: string } | null>(null);
  const [nudgeModal, setNudgeModal] = useState<"persona" | "product" | null>(null);
  const { activeId: nudgeBrandProfileId, profiles: nudgeProfiles } = useBrandProfileStorage(!!session?.browseMode);
  const { savePersona } = usePersonasStorage();
  const { products, save: saveProduct } = useProducts(nudgeBrandProfileId ?? "");
  const generateMutation = useApiMutation<GenerateCreativeParams, GenerateCreativeResult>('/api/generate-creative');
  const generating = generateMutation.isPending;
  const generated = displayedHeadlines !== null;

  const launched = launch.state.launchedCampaign;

  useEffect(() => {
    setSavedId(null);
  }, [displayedHeadlines, headlineIdx, creative.state.primaryText, creative.state.cta]);

  // 카피 훅 기본값은 InputForm 이 소유(ADR-050) — outcome·제품 선택 시 Ledger 편향을 추천 훅에 적용.
  // 디테일 유저가 칩으로 직접 바꾸면 그 선택이 우선(소프트 편향).

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

  const loadedFromLibraryRef = useRef(false);
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("adflow_loaded_creative"); } catch { /* sessionStorage 사용 불가 */ }
    if (!raw) return;
    try { sessionStorage.removeItem("adflow_loaded_creative"); } catch { /* 무시 */ }
    let loaded: { headline?: string; primary?: string; ctaId?: string; tone?: string; outcomeId?: string };
    try { loaded = JSON.parse(raw) as typeof loaded; } catch { return; }
    if (!loaded.headline) return;
    loadedFromLibraryRef.current = true;
    setDisplayedHeadlines([loaded.headline]);
    setHeadlineIdx(0);
    // outcome 을 함께 복원해 "이미 생성됨" 상태로 취급 — 목표 재선택·자동 재생성 덮어쓰기 방지.
    const outcomeId = loaded.outcomeId && OBJECTIVES_ALL.some((o) => o.id === loaded.outcomeId)
      ? (loaded.outcomeId as OutcomeChip)
      : null;
    if (outcomeId) {
      creative.dispatch({ type: "SET_OUTCOME", outcome: outcomeId });
      generatedForOutcomeRef.current = outcomeId;
      setStep(nextStepAfterBrief(outcomeId));
    }
    creative.dispatch({ type: "SET_HEADLINE", headline: loaded.headline });
    if (loaded.primary != null) creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: loaded.primary });
    if (loaded.ctaId && CTAS.some((c) => c.id === loaded.ctaId)) {
      creative.dispatch({ type: "SET_CTA", cta: loaded.ctaId as CtaId });
    }
    if (loaded.tone) creative.dispatch({ type: "SET_TONE", tone: loaded.tone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 학습 탭 CTA 계약 — `/create?hook=<CopyHook>` 진입 시 해당 훅을 InputForm 에 프리셀렉트.
  // InputForm 의 편향 기본값 effect 가 마운트 시 덮어쓰므로, sessionStorage 로 전달해 InputForm 이 소비.
  const hookParam = searchParams.get("hook");
  const [hookHandled, setHookHandled] = useState(false);
  useEffect(() => {
    if (hookHandled || !hookParam) return;
    setHookHandled(true);
    if (COPY_HOOKS.some((h) => h.id === hookParam)) {
      setHooks([hookParam as CopyHook]);
      try { sessionStorage.setItem("adflow_hook_preselect", hookParam); } catch { /* 무시 */ }
    }
    router.replace("/create");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookHandled, hookParam]);

  // A/B 우세 안 prefill 본체 — ConfirmModal 확인 후에도 호출되도록 effect 밖으로 분리.
  const applyCampaignPrefill = async (campaignId: string) => {
    // launched-storage(사용자 생성) → mock 시연 entry 순으로 A/B 정보 도출.
    const launchedEntry = loadLaunchedCampaign(campaignId);
    const mock = !launchedEntry ? getMockCampaign(campaignId) : null;

    let axis: AbTestAxis | undefined;
    let variantA: string | undefined;
    let variantB: string | undefined;
    let adIds: [string, string] | null = null;
    let startDate: string | null = null;
    let objective: string | undefined;

    if (launchedEntry?.abTestAxis && launchedEntry.abTestVariantA && launchedEntry.abTestVariantB && launchedEntry.adIds && launchedEntry.startDate) {
      axis = launchedEntry.abTestAxis;
      variantA = launchedEntry.abTestVariantA;
      variantB = abVariantLabel(launchedEntry.abTestVariantB);
      adIds = launchedEntry.adIds;
      startDate = launchedEntry.startDate;
      objective = launchedEntry.objective;
    } else if (mock?.abTestEnabled && mock.abTestAxis && mock.abTestVariantA && mock.abTestVariantB && mock.startDate) {
      axis = mock.abTestAxis;
      variantA = mock.abTestVariantA;
      variantB = mock.abTestVariantB;
      adIds = getMockCampaignAdIds(campaignId);
      startDate = mock.startDate;
    }

    router.replace("/create");
    if (!axis || !variantA || !variantB || !adIds || !startDate) return;
    if (axis === "image") {
      setPrefillBanner("이미지 축 우세 안은 자동으로 채울 수 없어요. 소재 스튜디오에서 이미지를 새로 만들어 주세요.");
      return;
    }

    // PRD-ab-testing.md §7.5 — 표시 경로(performance-step/campaigns[id])와 동일 계약: 서버 실측 ads 우선,
    // fake adIds(mock_ad_...) 폴백일 때만 seedMockAdRows 합성. 진 안이 채워지는 걸 막기 위해 실측 우선.
    const objectiveParam = objective ? `&objective=${objective}` : "";
    let ads: [AdKpi, AdKpi] | null = null;
    try {
      const res = await fetch(`/api/insights/${campaignId}?period=all&adIds=${adIds[0]},${adIds[1]}${objectiveParam}`);
      const data = res.ok ? ((await res.json()) as { ads?: [AdInsightsRow, AdInsightsRow] }) : null;
      if (data?.ads) {
        ads = [rowToKpi(data.ads[0]), rowToKpi(data.ads[1])];
      }
    } catch {
      // fetch 실패 — 아래 fake adIds 폴백으로.
    }
    if (!ads) {
      const isFakeAd = adIds.every((a) => a.startsWith("mock_ad_"));
      if (!isFakeAd) return;
      const seeded = seedMockAdRows(campaignId, startDate, adIds);
      ads = [rowToKpi(seeded[0]), rowToKpi(seeded[1])];
    }

    // PRD-ab-testing.md §8.2 4단계 — winner 'B' 면 variantB, 'A' 면 variantA. 그 외는 prefill 안 함.
    const verdict = judgeAbTest(ads[0], ads[1]);
    if (verdict.state !== "winner") return;
    const winnerText = verdict.winner === "B" ? variantB : variantA;
    const winnerLabel = verdict.winner === "B" ? "B안" : "A안";

    creative.dispatch({ type: "RESET" });
    launch.dispatch({ type: "RESET" });
    if (axis === "headline") {
      creative.dispatch({ type: "SET_HEADLINE", headline: winnerText });
      // "이미 생성됨" 취급 — 스튜디오 게이트 통과 + 재진입 시 자동 재생성으로 우세 안을 덮지 않게.
      setDisplayedHeadlines([winnerText]);
      setHeadlineIdx(0);
      generatedForOutcomeRef.current = null;
      setPrefillBanner(`이전 캠페인의 우세 안(${winnerLabel})을 기본으로 채웠어요. 이번엔 다른 축으로 A/B 해볼까요?`);
    } else {
      creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: winnerText });
      setPrefillBanner(`이전 캠페인의 우세 본문(${winnerLabel})을 기본으로 채웠어요. 헤드라인은 새로 생성해 주세요.`);
    }
    setStep(1);
  };

  const applyTournamentPrefill = (tournamentId: string) => {
    tournamentClient(!!session?.browseMode)
      .get(tournamentId)
      .then((t) => {
        router.replace("/create");
        if (!t) return;
        creative.dispatch({ type: "RESET" });
        launch.dispatch({ type: "RESET" });
        creative.dispatch({ type: "SET_HEADLINE", headline: t.champion.headline });
        if (t.champion.primaryText) creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: t.champion.primaryText });
        const objectiveValid = OBJECTIVES_ALL.some((o) => o.id === t.objective);
        if (objectiveValid) {
          creative.dispatch({ type: "SET_OUTCOME", outcome: t.objective as (typeof OBJECTIVES_ALL)[number]["id"] });
        }
        // 챔피언 카피를 "이미 생성됨" 으로 취급 — isStudioDone 게이트 통과 + 자동 재생성 방지.
        setDisplayedHeadlines([t.champion.headline]);
        setHeadlineIdx(0);
        generatedForOutcomeRef.current = objectiveValid ? (t.objective as OutcomeChip) : null;
        if (t.champion.imageUrl) {
          launch.dispatch({ type: "SET_IMAGE_DATA_URL", value: t.champion.imageUrl });
        }
        setStep(1);
        setPrefillBanner("토너먼트 챔피언 광고를 기본으로 채웠어요.");
      })
      .catch(() => router.replace("/create"));
  };

  useEffect(() => {
    if (prefillHandled || !prefillCampaignId) return;
    setPrefillHandled(true);
    // PRD-ab-testing.md §8.2 v0.2 Q7 — 진행 중 작업 가드. reference equality 로 dispatch 발생 여부 판정.
    const inProgress = creative.state !== INITIAL_CREATIVE_STATE || launch.state !== INITIAL_LAUNCH_STATE;
    if (inProgress) {
      setPendingPrefill({ kind: "campaign", id: prefillCampaignId });
      return;
    }
    void applyCampaignPrefill(prefillCampaignId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCampaignId, prefillHandled]);

  // 토너먼트 승자 승격 — `?prefill=tournament:{id}` 진입. WinnerHandlingPanel/DonePanel 이 챔피언 확정 후 push.
  useEffect(() => {
    if (tournamentPrefillHandled || !prefillTournamentId || status !== "authenticated") return;
    setTournamentPrefillHandled(true);
    const inProgress = creative.state !== INITIAL_CREATIVE_STATE || launch.state !== INITIAL_LAUNCH_STATE;
    if (inProgress) {
      setPendingPrefill({ kind: "tournament", id: prefillTournamentId });
      return;
    }
    applyTournamentPrefill(prefillTournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTournamentId, tournamentPrefillHandled, status]);

  // P0 초안 영속화 — 재진입 시 이어하기 배너. prefill·라이브러리 재활용 진입은 각자 흐름이 우선.
  const [resumeDraft, setResumeDraft] = useState<CreateDraftSnapshot | null>(null);
  useEffect(() => {
    if (prefillRaw || channelInsightsFrom || hookParam || loadedFromLibraryRef.current) return;
    const draft = loadDraftFromSession();
    if (draft) setResumeDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResumeDraft = () => {
    if (!resumeDraft) return;
    hydrateCreativeDraft(creative.dispatch, resumeDraft.creative);
    hydrateLaunchDraft(launch.dispatch, resumeDraft.launch);
    const s = resumeDraft.studio;
    setDisplayedHeadlines(s.displayedHeadlines);
    setDisplayedSubtitles(s.displayedSubtitles);
    setHeadlineIdx(s.headlineIdx);
    setDisplayedPrimaryTexts(s.displayedPrimaryTexts);
    setDisplayedHooks(s.displayedHooks);
    setProofPointsCited(s.proofPointsCited);
    setPrimaryTextIdx(s.primaryTextIdx);
    setHooks(s.hooks);
    generatedForOutcomeRef.current = s.generatedForOutcome;
    setStep(resumeDraft.step);
    setResumeDraft(null);
  };

  const handleDiscardDraft = () => {
    clearDraftFromSession();
    setResumeDraft(null);
  };

  // 초안 미러링 — debounce 800ms. 이어하기 배너 응답 전에는 저장하지 않아 기존 초안을 지키고,
  // 게재 완료 시 초안 삭제. 빈 상태(목표·생성물 없음)는 저장하지 않는다.
  useEffect(() => {
    if (resumeDraft) return;
    if (launch.state.launchedCampaign) {
      clearDraftFromSession();
      return;
    }
    const meaningful = step > 0 || creative.state.outcome !== null || displayedHeadlines !== null;
    if (!meaningful) return;
    const timer = setTimeout(() => {
      void (async () => {
        const img = launch.state.imageDataUrl ? await shrinkImageDataUrl(launch.state.imageDataUrl) : null;
        const finalImg = launch.state.finalImageDataUrl ? await shrinkImageDataUrl(launch.state.finalImageDataUrl) : null;
        saveDraftToSession(
          step,
          creative.state,
          { ...launch.state, imageDataUrl: img, finalImageDataUrl: finalImg },
          {
            displayedHeadlines,
            displayedSubtitles,
            headlineIdx,
            displayedPrimaryTexts,
            displayedHooks,
            proofPointsCited,
            primaryTextIdx,
            hooks,
            generatedForOutcome: generatedForOutcomeRef.current,
          },
        );
      })();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    creative.state,
    launch.state,
    displayedHeadlines,
    displayedSubtitles,
    headlineIdx,
    displayedPrimaryTexts,
    displayedHooks,
    proofPointsCited,
    primaryTextIdx,
    hooks,
    resumeDraft,
  ]);

  // productId 변경 시 제품의 targetUrl → landingUrl 자동 프리필 (비어있을 때만)
  useEffect(() => {
    if (!productId) return;
    const product = products.find((pr) => pr.id === productId);
    if (product?.targetUrl && !launch.state.landingUrl.trim()) {
      launch.dispatch({ type: "SET_LANDING_URL", value: product.targetUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, products]);

  const runGenerate = (personaIdOverride?: string) => {
    if (!creative.state.outcome) {
      showToast("원하는 결과(outcome)를 먼저 골라주세요");
      return;
    }
    const startedAt = Date.now();
    const bp = readBrandProfile();
    const bpEntry = readActiveBrandProfileEntry();
    const isCustomBrandMode = customBrand;
    const effectivePersonaId = personaIdOverride ?? personaId;
    const personaEntry = effectivePersonaId ? readPersonas().find((pe) => pe.id === effectivePersonaId) : undefined;
    const productEntry = productId ? products.find((pr) => pr.id === productId) : undefined;
    const selectedCopyTexts = selectedCopyRefIds.length > 0
      ? (bpEntry?.copyReferences ?? [])
          .filter((r) => selectedCopyRefIds.includes(r.id))
          .map((r) => r.text)
      : undefined;

    generateMutation.mutate(
      {
        brand: isCustomBrandMode ? (brand || bp.brandDescription || "") : (bp.brandDescription || brand),
        target: target || undefined,
        tone: isCustomBrandMode ? creative.state.tone : (bp.tone ?? creative.state.tone),
        outcome: creative.state.outcome,
        hint: creative.state.outcomeHint,
        hooks: hooks.length === 3 ? hooks : undefined,
        brandProfile: isCustomBrandMode ? {
          policy: bpEntry?.policy,
        } : {
          brandDescription: bp.brandDescription,
          brandVoice: bp.brandVoice,
          customerVoiceSummary: bp.customerVoiceSummary,
          policy: bpEntry?.policy,
          copyReferences: selectedCopyTexts,
          proofPoints: bp.proofPoints,
        },
        persona: personaEntry
          ? {
              name: personaEntry.name,
              customerDescription: personaEntry.customerDescription,
              interests: personaEntry.interests,
            }
          : undefined,
        product: productEntry
          ? {
              name: productEntry.name,
              description: productEntry.description,
              price: productEntry.price,
            }
          : undefined,
      },
      {
        onSuccess: (data) => {
          setDisplayedHeadlines(data.headlines);
          setDisplayedSubtitles(data.subtitles);
          setHeadlineIdx(0);
          setDisplayedPrimaryTexts(data.primaryTexts);
          setDisplayedHooks(data.hooks);
          setProofPointsCited(data.proofPointsCited ?? null);
          setAttribution(data.attribution ?? null);
          // ADR-052 — 빈 필드 보상 넛지. 프로필 모드에서만(직접입력·무프로필은 프로필 채울 대상 없음).
          const profileMode = !!bpEntry && !isCustomBrandMode;
          setNudge(
            profileMode
              ? selectProfileNudge(creative.state.outcome!, {
                  persona: !!personaId,
                  product: !!productId,
                  proofPoints: !!bp.proofPoints?.some((t) => t.trim()),
                  imageGuide: !!bp.imageGuide?.trim(),
                  tone: !!bp.tone?.trim(),
                  brandVoice: !!bp.brandVoice?.trim(),
                })
              : null,
          );
          setPrimaryTextIdx(0);
          creative.dispatch({ type: "SET_HEADLINE", headline: data.headlines[0] });
          creative.dispatch({ type: "SET_SUBTITLE", subtitle: data.subtitles[0] });
          // PRD §5.4.2 (5) — STEP 02 디테일 A/B 시험 B안 풀로 사용. 재생성 시 후보 교체 → DetailKnobs 의 sync useEffect 가 B안 reset.
          creative.dispatch({ type: "SET_HEADLINE_CANDIDATES", candidates: data.headlines });
          creative.dispatch({ type: "SET_PRIMARY_TEXT_CANDIDATES", candidates: data.primaryTexts });
          creative.dispatch({ type: "SET_SUBTITLE_CANDIDATES", candidates: data.subtitles });
          creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: data.primaryTexts[0] });
          // ADR-022 — AI 추천 위에 페르소나 명시 필드만 override. 비운 필드는 AI 추천 유지.
          const merged = mergePersonaTargeting(data.targeting, personaEntry);
          creative.dispatch({ type: "SET_TARGETING", targeting: merged.targeting });
          creative.dispatch({ type: "SET_TARGETING_SOURCE", source: merged.source });
          setElapsed(Math.round((Date.now() - startedAt) / 100) / 10);
        },
        onError: (err) => {
          console.error("[generate-creative]", err);
          showToast("카피 생성에 실패했어요, 다시 시도해주세요");
        },
      },
    );
  };

  // 새 생성(InputForm 버튼) — before/after·추가상태 초기화.
  const handleGenerate = (personaIdOverride?: string) => {
    setBeforeAfter(null);
    setAddedTarget(null);
    runGenerate(personaIdOverride);
  };

  // ADR-052 — 넛지로 추가한 뒤 "추가하고 다시 생성". 현재 안을 이전 안으로 스냅샷.
  const handleRegenerate = () => {
    const before = displayedHeadlines?.[headlineIdx];
    if (before && addedTarget) setBeforeAfter({ before, label: NUDGE_LABEL[addedTarget] });
    setAddedTarget(null);
    runGenerate();
  };

  const handleNudgeAdd = () => {
    if (!nudge) return;
    if (nudge.target === "persona") setNudgeModal("persona");
    else if (nudge.target === "product") setNudgeModal("product");
    else router.push(nudgeBrandProfileId ? `/brand-profile/${nudgeBrandProfileId}` : "/brand-profile");
  };

  const handleSelectHeadline = (i: number) => {
    setHeadlineIdx(i);
    if (displayedHeadlines) creative.dispatch({ type: "SET_HEADLINE", headline: displayedHeadlines[i] });
    // 짝 인덱스 부제 동반 선택 — "고를 땐 묶고, 시험할 땐 쪼갠다".
    if (displayedSubtitles) creative.dispatch({ type: "SET_SUBTITLE", subtitle: displayedSubtitles[i] ?? "" });
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
    clearDraftFromSession();
    creative.dispatch({ type: "RESET" });
    launch.dispatch({ type: "RESET" });
    generateMutation.reset();
    setDisplayedHeadlines(null);
    setHeadlineIdx(0);
    setDisplayedPrimaryTexts(null);
    setPrimaryTextIdx(0);
    setSavedId(null);
    setElapsed(0);
    setAttribution(null);
    setNudge(null);
    setAddedTarget(null);
    setBeforeAfter(null);
    setCustomBrand(false);
    setStep(0);
  };

  // PRD-create-flow-redesign §3.4 — 광고 목표 변경 = 브리프(step 0) 복귀. 브리프·스튜디오의 SelectedGoalCard 둘 다 사용.
  const handleChangeOutcome = () => {
    creative.dispatch({ type: "SET_OUTCOME", outcome: null });
    setStep(0);
  };

  // 01→02 진입 게이트: 목표 존재. 02→03 진입 게이트: boost 면 항상, 아니면 헤드라인+이미지 존재.
  const hasImage = !!(launch.state.finalImageDataUrl || launch.state.imageDataUrl);
  const briefDone = isBriefDone(creative.state.outcome);
  const studioDone = isStudioDone(creative.state.outcome, generated, hasImage);
  const completed = [briefDone, studioDone, !!launched];
  const stepValid: [boolean, boolean] = [briefDone, studioDone];

  // 둘러보기 모드 — 콘텐츠를 화면 세로 중앙에 배치 (빈 공간 있을 때만 중앙, 길면 위부터)
  const browseMode = !!session?.browseMode;

  return (
    <div className={`px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7 min-h-[calc(100vh-64px)]${browseMode ? " justify-center" : ""}`} data-screen-label="광고 만들기">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">광고 만들기</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>
            {TITLES[step]}
          </h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
            {SUBS[step]}
          </p>
        </div>
        <div>
          <Chip variant="violet" dot>DRAFT · {String(step + 1).padStart(2, "0")}</Chip>
        </div>
      </div>

      {prefillBanner && (
        <div className="flex items-center gap-3 p-[14px] bg-[var(--w-primary-soft)] rounded-xl">
          <Icon name="sparkles" size={16} />
          <p style={{ flex: 1, font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: 0 }}>
            {prefillBanner}
          </p>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              creative.dispatch({ type: "RESET" });
              launch.dispatch({ type: "RESET" });
              setPrefillBanner(null);
            }}
          >
            지우고 새로 시작
          </Button>
        </div>
      )}

      {resumeDraft && (
        <div className="flex items-center gap-3 p-[14px] bg-[var(--w-primary-soft)] rounded-xl">
          <Icon name="clock" size={16} />
          <p style={{ flex: 1, font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: 0 }}>
            작업하던 광고가 있어요. 이어서 만들까요?
          </p>
          <Button variant="primary" size="sm" type="button" onClick={handleResumeDraft}>
            이어하기
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={handleDiscardDraft}>
            새로 시작
          </Button>
        </div>
      )}

      <Stepper step={Math.min(step, 2)} setStep={setStep} completed={completed} stepValid={stepValid} />

      {step === 0 && (
        <GoalIntro
          onNext={() => {
            const next = nextStepAfterBrief(creative.state.outcome);
            setStep(next);
            if (next === 1 && shouldTriggerGenerate(!!displayedHeadlines, generatedForOutcomeRef.current, creative.state.outcome)) {
              generatedForOutcomeRef.current = creative.state.outcome;
              // generate-first가 스튜디오 진입 전에 발사 — 프로필 모드는 첫 생성부터 페르소나가 반영되게
              // 활성 프로필의 기본(첫 번째) 페르소나를 auto-select. 유저가 이미 고른 페르소나는 유지.
              // setPersonaId 는 다음 렌더에 반영되므로, runGenerate 에는 override 로 직접 전달.
              let personaIdOverride: string | undefined;
              if (!personaId && !customBrand) {
                const bpEntry = readActiveBrandProfileEntry();
                const first = bpEntry ? readPersonas().find((pe) => pe.brandProfileId === bpEntry.id) : undefined;
                if (first) {
                  setPersonaId(first.id);
                  personaIdOverride = first.id;
                }
              }
              handleGenerate(personaIdOverride);
            }
          }}
          brand={brand}
          setBrand={setBrand}
          target={target}
          setTarget={setTarget}
          productId={productId}
          setProductId={setProductId}
          customBrand={customBrand}
          setCustomBrand={setCustomBrand}
        />
      )}

      {step === 1 && (
        <CreativeStep
          outcome={creative.state.outcome}
          personaId={personaId}
          setPersonaId={setPersonaId}
          productId={productId}
          tone={creative.state.tone}
          setTone={(id) => creative.dispatch({ type: "SET_TONE", tone: id })}
          onChangeOutcome={handleChangeOutcome}
          onBack={() => setStep(0)}
          generating={generating}
          generated={generated}
          selectedCopyRefIds={selectedCopyRefIds}
          setSelectedCopyRefIds={setSelectedCopyRefIds}
          hooks={hooks}
          setHooks={setHooks}
          attribution={attribution}
          nudge={nudge}
          onNudgeAdd={handleNudgeAdd}
          addedLabel={addedTarget ? NUDGE_LABEL[addedTarget] : null}
          onRegenerate={handleRegenerate}
          beforeAfter={beforeAfter}
          displayedHooks={displayedHooks}
          proofPointsCited={proofPointsCited}
          headlines={displayedHeadlines}
          subtitles={displayedSubtitles}
          subtitle={creative.state.subtitle}
          setSubtitle={(v: string) => creative.dispatch({ type: "SET_SUBTITLE", subtitle: v })}
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
            if (personaId) {
              const pe = readPersonas().find((p) => p.id === personaId);
              if (pe) {
                // 생성을 안 했으면 AI 추천이 없으므로 기본값 baseline 위에 페르소나 override.
                // 생성했다면 onSuccess 에서 이미 merge 됐으니 그대로 둠.
                if (!creative.state.targeting) {
                  const merged = mergePersonaTargeting({ ageMin: 18, ageMax: 65, genders: [] }, pe);
                  creative.dispatch({ type: "SET_TARGETING", targeting: merged.targeting });
                  creative.dispatch({ type: "SET_TARGETING_SOURCE", source: merged.source });
                }
                launch.dispatch({ type: "SET_PERSONA_LOCATION", value: pe.location ?? [] });
              }
            }
            setStep(2);
          }}
          imageDataUrl={launch.state.imageDataUrl}
          setImageDataUrl={(v) => launch.dispatch({ type: "SET_IMAGE_DATA_URL", value: v })}
          finalImageDataUrl={launch.state.finalImageDataUrl}
          setFinalImageDataUrl={(v) => launch.dispatch({ type: "SET_FINAL_IMAGE_DATA_URL", value: v })}
        />
      )}

      {step === 2 && (
        // onNext — BoostPostFlow 전용 레거시 prop. 게재 성공 시 launchedCampaign dispatch 로
        // LaunchStep 이 즉시 완료 상태로 전환되므로(§3.3) 실제로 호출되지 않는다.
        <LaunchStep
          onNext={() => {}}
          goSettings={() => router.push("/setup")}
          goCreative={() => setStep(1)}
          brandName={brand ? brand.slice(0, 20) : undefined}
          onRestart={handleRestart}
        />
      )}

      {pendingPrefill && (
        <ConfirmModal
          title="작업 중인 광고가 있어요"
          desc={
            pendingPrefill.kind === "campaign"
              ? "이전 캠페인의 우세 안으로 덮어쓸까요? 지금 작업 내용은 사라져요."
              : "토너먼트 챔피언 안으로 덮어쓸까요? 지금 작업 내용은 사라져요."
          }
          confirmLabel="덮어쓰기"
          cancelLabel="지금 작업 유지"
          tone="primary"
          onConfirm={() => {
            const pending = pendingPrefill;
            setPendingPrefill(null);
            if (pending.kind === "campaign") void applyCampaignPrefill(pending.id);
            else applyTournamentPrefill(pending.id);
          }}
          onClose={() => {
            setPendingPrefill(null);
            router.replace("/create");
          }}
        />
      )}

      {/* ADR-052 — 넛지 보상 루프: 인라인 quick-add → 프로필 영구 저장 → 추가 표시 */}
      {nudgeModal === "persona" && (
        <PersonaQuickCreateModal
          activeBrandProfileId={nudgeBrandProfileId}
          profiles={nudgeProfiles}
          onSave={(entry) => {
            savePersona(entry);
            setPersonaId(entry.id);
            setAddedTarget("persona");
            setNudgeModal(null);
          }}
          onClose={() => setNudgeModal(null)}
        />
      )}
      {nudgeModal === "product" && nudgeBrandProfileId && (
        <ProductEditModal
          brandProfileId={nudgeBrandProfileId}
          onSave={async (entry, file) => {
            await saveProduct(entry, file);
            setProductId(entry.id);
            setAddedTarget("product");
            setNudgeModal(null);
          }}
          onClose={() => setNudgeModal(null)}
        />
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateFlow />
    </Suspense>
  );
}
