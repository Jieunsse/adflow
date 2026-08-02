"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { nextStepAfterBrief, shouldTriggerGenerate } from "@entities/creative/brief-flow";
import { browseCreative, browseRefinedBody } from "@entities/creative/browse/seed";
import { refineInstruction, type RefineId } from "@entities/creative/refine-presets";
import {
  saveDraftToSession,
  loadDraftFromSession,
  clearDraftFromSession,
  hydrateCreativeDraft,
  hydrateLaunchDraft,
  type CreateDraftSnapshot,
} from "@entities/creative/draft-persistence";
import { shrinkImageDataUrl } from "@shared/lib/shrink-image";
import LaunchStep from "@widgets/launch-step";
import BriefStep from "@widgets/create-flow/BriefStep";
import GeneratingPanel from "@widgets/create-flow/GeneratingPanel";
import CompareStep from "@widgets/create-flow/CompareStep";
import ImageConceptStep from "@widgets/create-flow/ImageConceptStep";
import RefineStep from "@widgets/create-flow/RefineStep";
import { savedAgoLabel } from "@widgets/create-flow/copy-diff";
import { useStudioSession } from "@widgets/create-flow/useStudioSession";
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

// 둘러보기에서 카피 시드를 꺼내기까지 두는 시간 — 생성 중 화면(시안 1f)을 실제와 비슷하게 지나가게 한다.
const BROWSE_GENERATE_MS = 1400;
const BROWSE_REFINE_MS = 900;

function CreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const showToast = useToast();
  const library = useLibrary();
  // 둘러보기 모드 — 백엔드에 닿지 않는 시연 레이어(ADR-033). 화면 세로 중앙 배치에도 쓴다.
  const browseMode = !!session?.browseMode;
  // 확정 플로우 — 0 브리프(1d) · 1 소재(1f 생성 중 → 1c 3안 비교 → 2a 이미지 3컷 → 2b 다듬기) · 2 게재(1e → 2c).
  const [step, setStep] = useState(0);
  const studio = useStudioSession();
  // 자동 저장 pill 은 실제로 저장이 끝난 시각만 보여준다. 문구는 30초마다만 다시 계산한다.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // 둘러보기는 API 대신 시드를 쓰지만, 생성 중 화면(시안 1f)은 똑같이 지나가야 한다.
  const [browseBusy, setBrowseBusy] = useState<null | "generate" | "refine">(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!lastSavedAt) return;
    const tick = () => setSavedLabel(savedAgoLabel(lastSavedAt, Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

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
  // 2b 의 "AI로 고치기" — 3안 생성과 별도 mutation 이라 진행 표시가 섞이지 않는다.
  const refineMutation = useApiMutation<GenerateCreativeParams, GenerateCreativeResult>('/api/generate-creative');
  const generating = generateMutation.isPending || browseBusy === "generate";
  const launched = launch.state.launchedCampaign;

  useEffect(() => {
    setSavedId(null);
  }, [studio.headlines, studio.headlineIdx, creative.state.primaryText, creative.state.cta]);

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
    studio.setHeadlineCandidates([loaded.headline]);
    // outcome 을 함께 복원해 "이미 생성됨" 상태로 취급 — 목표 재선택·자동 재생성 덮어쓰기 방지.
    const outcomeId = loaded.outcomeId && OBJECTIVES_ALL.some((o) => o.id === loaded.outcomeId)
      ? (loaded.outcomeId as OutcomeChip)
      : null;
    if (outcomeId) {
      creative.dispatch({ type: "SET_OUTCOME", outcome: outcomeId });
      studio.setGeneratedForOutcome(outcomeId);
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
      studio.setHooks([hookParam as CopyHook]);
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
      studio.setHeadlineCandidates([winnerText]);
      studio.setGeneratedForOutcome(null);
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
        studio.setHeadlineCandidates([t.champion.headline]);
        studio.setGeneratedForOutcome(objectiveValid ? (t.objective as OutcomeChip) : null);
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
    studio.restore(resumeDraft.studio);
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
    const meaningful = step > 0 || creative.state.outcome !== null || studio.snapshot.displayedHeadlines !== null;
    if (!meaningful) return;
    const timer = setTimeout(() => {
      void (async () => {
        const img = launch.state.imageDataUrl ? await shrinkImageDataUrl(launch.state.imageDataUrl) : null;
        const finalImg = launch.state.finalImageDataUrl ? await shrinkImageDataUrl(launch.state.finalImageDataUrl) : null;
        saveDraftToSession(
          step,
          creative.state,
          { ...launch.state, imageDataUrl: img, finalImageDataUrl: finalImg },
          studio.snapshot,
        );
        setLastSavedAt(Date.now());
      })();
    }, 800);
    return () => clearTimeout(timer);
  }, [
    step,
    creative.state,
    launch.state,
    studio.snapshot,
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

  // 카피 생성에 넣을 재료 조립 — 3안 생성과 "AI로 고치기"(2b) 가 같은 재료를 쓴다.
  const buildGenerateContext = (personaIdOverride?: string) => {
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

    const params: GenerateCreativeParams = {
      brand: isCustomBrandMode ? (brand || bp.brandDescription || "") : (bp.brandDescription || brand),
      target: target || undefined,
      tone: isCustomBrandMode ? creative.state.tone : (bp.tone ?? creative.state.tone),
      outcome: creative.state.outcome!,
      hint: creative.state.outcomeHint,
      hooks: studio.hooks.length === 3 ? studio.hooks : undefined,
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
    };
    return { params, bp, bpEntry, isCustomBrandMode, personaEntry };
  };

  const runGenerate = (personaIdOverride?: string) => {
    if (!creative.state.outcome) {
      showToast("원하는 결과(outcome)를 먼저 골라주세요");
      return;
    }
    const { params, bp, bpEntry, isCustomBrandMode, personaEntry } = buildGenerateContext(personaIdOverride);

    const applyGenerated = (data: GenerateCreativeResult) => {
      studio.applyGenerated(data);
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
    };

    // 둘러보기는 백엔드에 닿지 않는다(ADR-033) — 미리 써 둔 카피를 쓰되 생성 중 화면은 그대로 지나간다.
    if (browseMode) {
      setBrowseBusy("generate");
      const seeded = browseCreative(params);
      setTimeout(() => {
        applyGenerated(seeded);
        setBrowseBusy(null);
      }, BROWSE_GENERATE_MS);
      return;
    }

    generateMutation.mutate(params, {
      onSuccess: applyGenerated,
      onError: (err) => {
        console.error("[generate-creative]", err);
        showToast("카피 생성에 실패했어요, 다시 시도해주세요");
      },
    });
  };

  // 시안 2b "AI로 고치기" — 같은 재료 + 고치기 지시로 다시 뽑아 본문 하나만 갈아끼운다.
  // 헤드라인·후보 풀은 건드리지 않는다(사용자가 확정한 안을 지킨다).
  const handleRefineBody = (id: RefineId) => {
    if (!creative.state.outcome) return;
    const hook = studio.displayedHooks?.[studio.primaryTextIdx];
    const { params } = buildGenerateContext();

    // 둘러보기는 화면에 있는 본문을 그대로 받아 라벨이 말하는 방향으로만 고친다(seed.ts).
    if (browseMode) {
      setBrowseBusy("refine");
      const next = browseRefinedBody(creative.state.primaryText, id, {
        proofPoints: params.brandProfile?.proofPoints,
        ctaLabel: CTAS.find((c) => c.id === creative.state.cta)?.label,
      });
      setTimeout(() => {
        creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: next });
        setBrowseBusy(null);
      }, BROWSE_REFINE_MS);
      return;
    }

    refineMutation.mutate(
      {
        ...params,
        hint: [creative.state.outcomeHint, refineInstruction(id)].filter(Boolean).join(" · "),
        hooks: hook ? [hook, hook, hook] : params.hooks,
        variationIntensity: "subtle",
      },
      {
        onSuccess: (data) => {
          creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: data.primaryTexts[0] });
        },
        onError: (err) => {
          console.error("[generate-creative/refine]", err);
          showToast("본문을 고치지 못했어요, 다시 시도해주세요");
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
    const before = studio.headlines?.[studio.headlineIdx];
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

  const handleSaveToLibrary = () => {
    if (!studio.headlines) return;
    const toneLabel = TONES.find((t) => t.id === creative.state.tone)?.label ?? creative.state.tone;
    const ctaLabel = CTAS.find((c) => c.id === creative.state.cta)?.label ?? creative.state.cta;
    // PRD §13.10 — Goal Select 폐기. 라이브러리 goal 칼럼은 outcome 칩 의 outcomeLabel 로 채워 호환 유지.
    const goalLabel = creative.state.outcome
      ? OBJECTIVES_ALL.find((o) => o.id === creative.state.outcome)?.outcomeLabel ?? ""
      : "";
    const id = library.save({
      brand,
      headline: studio.headlines[studio.headlineIdx],
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
    studio.reset();
    setSavedId(null);
    setAttribution(null);
    setNudge(null);
    setAddedTarget(null);
    setBeforeAfter(null);
    setCustomBrand(false);
    setStep(0);
  };

  // 브리프 → 소재. boost_post 는 소재 단계를 건너뛰고 바로 게재로 간다(nextStepAfterBrief).
  const startGenerate = () => {
    const next = nextStepAfterBrief(creative.state.outcome);
    setStep(next);
    studio.setPhase("compare");
    if (next !== 1) return;
    if (!shouldTriggerGenerate(!!studio.headlines, studio.generatedForOutcome, creative.state.outcome)) return;
    studio.setGeneratedForOutcome(creative.state.outcome);
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
  };

  // 소재 → 게재. 페르소나가 있으면 타겟팅·지역을 게재 초안으로 옮겨 준다.
  const goDelivery = () => {
    if (personaId) {
      const pe = readPersonas().find((x) => x.id === personaId);
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
  };

  // 3안 카드 하나를 고르면 헤드라인·본문·부제가 같은 인덱스로 함께 움직인다.
  const handleSelectVersion = (i: number) => {
    const selected = studio.selectVersion(i);
    if (selected.headline) creative.dispatch({ type: "SET_HEADLINE", headline: selected.headline });
    // 짝 인덱스 부제 동반 선택 — "고를 땐 묶고, 시험할 땐 쪼갠다".
    if (selected.subtitle != null) creative.dispatch({ type: "SET_SUBTITLE", subtitle: selected.subtitle });
    if (selected.primaryText) creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: selected.primaryText });
  };


  return (
    <div className={`px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7 min-h-[calc(100vh-64px)]${browseMode ? " justify-center" : ""}`} data-screen-label="광고 만들기">
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

      {/* 게재까지 끝낸 화면(시안 2c) 위에 "이어하기" 띠가 남으면 무엇이 지금인지 헷갈린다. */}
      {resumeDraft && !launched && (
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

      {step === 0 && (
        <BriefStep
          brand={brand}
          setBrand={setBrand}
          target={target}
          setTarget={setTarget}
          productId={productId}
          setProductId={setProductId}
          personaId={personaId}
          setPersonaId={setPersonaId}
          customBrand={customBrand}
          setCustomBrand={setCustomBrand}
          onGenerate={startGenerate}
        />
      )}

      {step === 1 && generating && <GeneratingPanel outcome={creative.state.outcome} />}

      {step === 1 && !generating && studio.phase === "compare" && (
        <CompareStep
          savedLabel={savedLabel}
          headlines={studio.headlines ?? []}
          primaryTexts={studio.primaryTexts ?? []}
          hooks={studio.displayedHooks}
          proofPointsCited={studio.proofPointsCited}
          selectedIdx={studio.headlineIdx}
          onSelect={handleSelectVersion}
          imageUrl={launch.state.finalImageDataUrl ?? launch.state.imageDataUrl}
          personaId={personaId}
          regenerating={generating}
          onRegenerate={() => handleGenerate()}
          onEditBrief={() => setStep(0)}
          onNext={() => studio.setPhase("image")}
          attribution={attribution}
          nudge={nudge}
          onNudgeAdd={handleNudgeAdd}
          addedLabel={addedTarget ? NUDGE_LABEL[addedTarget] : null}
          onRegenerateAfterAdd={handleRegenerate}
          beforeAfter={beforeAfter}
        />
      )}

      {step === 1 && !generating && studio.phase === "image" && (
        <ImageConceptStep
          savedLabel={savedLabel}
          productId={productId}
          selectedVerIdx={studio.headlineIdx}
          imageDataUrl={launch.state.imageDataUrl}
          setImageDataUrl={(v) => launch.dispatch({ type: "SET_IMAGE_DATA_URL", value: v })}
          finalImageDataUrl={launch.state.finalImageDataUrl}
          setFinalImageDataUrl={(v) => launch.dispatch({ type: "SET_FINAL_IMAGE_DATA_URL", value: v })}
          onBackToCompare={() => studio.setPhase("compare")}
          onNext={() => studio.setPhase("refine")}
        />
      )}

      {step === 1 && !generating && studio.phase === "refine" && (
        <RefineStep
          savedLabel={savedLabel}
          verIdx={studio.headlineIdx}
          hook={studio.displayedHooks?.[studio.primaryTextIdx] ?? null}
          headline={creative.state.headline}
          setHeadline={(v) => creative.dispatch({ type: "SET_HEADLINE", headline: v })}
          headlineCandidates={studio.headlines}
          primaryText={creative.state.primaryText}
          setPrimaryText={(v) => creative.dispatch({ type: "SET_PRIMARY_TEXT", primaryText: v })}
          cta={creative.state.cta}
          imageUrl={launch.state.finalImageDataUrl ?? launch.state.imageDataUrl}
          refining={refineMutation.isPending || browseBusy === "refine"}
          onRefine={handleRefineBody}
          onBack={() => studio.setPhase("compare")}
          onNext={goDelivery}
          saved={!!savedId}
          onSaveToLibrary={handleSaveToLibrary}
          goLibrary={() => router.push("/library")}
        />
      )}

      {step === 2 && (
        // onNext — BoostPostFlow 전용 레거시 prop. 게재 성공 시 launchedCampaign dispatch 로
        // LaunchStep 이 즉시 완료 상태(시안 2c)로 전환되므로 실제로 호출되지 않는다.
        <LaunchStep
          onNext={() => {}}
          goSettings={() => router.push("/setup")}
          goCreative={() => { setStep(1); studio.setPhase("refine"); }}
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
