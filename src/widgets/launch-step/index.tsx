"use client";

// STEP 03 게재 계획서 widget — PRD-create-flow-redesign §3.3.
// 카드 스택(도착지·예산·타겟·A/B·고급 설정) 상시 노출 + 우측 sticky(프리뷰·요약·게재).
// 게재 성공(state.launchedCampaign) 시 같은 화면이 완료 상태로 전환.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft, type LaunchParams, type LaunchResponse } from "@entities/campaign/model";
import { saveLaunchedCampaign } from "@entities/campaign/launched-storage";
import { createBrowseCampaign } from "@entities/campaign/browse/seed";
import { shrinkImageDataUrl } from "@shared/lib/shrink-image";
import { type ObjectivePhase1Id } from "@entities/creative/options";
import { isBoost, goalDefOf } from "@entities/creative/outcome-routing";
import { profileOf } from "@entities/launch-objective/profile";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { addNotification } from "@shared/lib/notifications";
import { useAutoRelaunch } from "@shared/lib/autoRelaunch";
import { useToast } from "@shared/ui/Toast";
import { validateAdImage, buildLaunchParams, buildLaunchedCampaign, launchSuccessMessage, planBrowseLaunch } from "@features/launch-campaign/build";
import { launchBlockReason, firstInvalidCard, type PlanCardId } from "@features/launch-campaign/plan-status";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";

import ObjectivePicker from "./ObjectivePicker";
import DetailKnobs from "./DetailKnobs";
import ABCreativeKnob from "./ABCreativeKnob";
import DestinationField from "./DestinationField";
import CreativePreview from "./CreativePreview";
import SummaryCard from "./SummaryCard";
import CallScheduleSection from "./CallScheduleSection";
import MessagesAutoReplyCallout from "./MessagesAutoReplyCallout";
import PageActivityCallout from "./PageActivityCallout";
import PreLaunchSafetyModal from "./PreLaunchSafetyModal";
import BudgetScheduleStep from "./BudgetScheduleStep";
import TargetStep from "./TargetStep";
import ConfirmStep from "./ConfirmStep";
import BoostPostFlow from "./BoostPostFlow";
import PostLaunchChecklist from "@widgets/post-launch-checklist";
import { validateLaunch, type ValidationIssue } from "@features/launch-validation";

interface Props {
  onNext: () => void;
  goSettings: () => void;
  /** PRD-create-flow-redesign §3.4 — 소재 스튜디오(step 1)로 비파괴 복귀. */
  goCreative: () => void;
  brandName?: string;
  onRestart: () => void;
}

const CARD_DOM_ID: Record<PlanCardId, string> = {
  destination: "plan-card-destination",
  target: "plan-card-target",
};

export default function LaunchStep({ onNext, goSettings, goCreative, brandName, onRestart }: Props) {
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const state = launch.state;
  const dispatch = launch.dispatch;
  const { setEnabled: setAutoRelaunch } = useAutoRelaunch();

  // STEP 03 진입 시 — 소재 스튜디오 AI가 채운 타겟팅으로 연령·성별 prefill.
  const targeting = creative.state.targeting;
  useEffect(() => {
    if (!targeting) return;
    dispatch({ type: "APPLY_CREATIVE_TARGETING", targeting });
  }, [targeting, dispatch]);

  const { data: session } = useSession();
  const accountConnected = !!(session?.adAccountId && session?.pageId);
  const browseMode = !!session?.browseMode;
  const launchMutation = useApiMutation<LaunchParams, LaunchResponse>("/api/campaign");
  const showToast = useToast();

  const outcomeChip = creative.state.outcome;
  const isBoostPost = isBoost(outcomeChip);
  const goalDef = goalDefOf(outcomeChip);
  const profile = profileOf(outcomeChip);

  // PRD-objective-aware-launch §5.2 — 목표 변경 시 호환 보존·종속 리셋 + toast.
  const prevOutcomeRef = useRef(outcomeChip);
  useEffect(() => {
    const prev = prevOutcomeRef.current;
    if (prev === outcomeChip) return;
    prevOutcomeRef.current = outcomeChip;
    if (prev === null || outcomeChip === null) return;
    dispatch({ type: "MIGRATE_FOR_OBJECTIVE_CHANGE" });
    const prevLabel = goalDefOf(prev)?.label ?? prev;
    const nextLabel = goalDefOf(outcomeChip)?.label ?? outcomeChip;
    showToast(`목표 변경됨: ${prevLabel} → ${nextLabel}. URL·고유 설정이 새 목표에 맞게 초기화됐어요.`);
  }, [outcomeChip, dispatch, showToast]);

  // 페이지 목록 — leads_call goal 사전 차단용 phone 확인.
  const { data: pagesData } = useQuery({
    queryKey: ["setup-pages"],
    queryFn: async (): Promise<{ pages: { id: string; name: string; phone: string | null }[] }> => {
      const res = await fetch("/api/setup/pages");
      if (!res.ok) throw new Error("페이지 조회 실패");
      return res.json();
    },
    enabled: !!session?.pageId,
  });
  const activePage = pagesData?.pages.find((p) => p.id === session?.pageId);

  // PRD-objective-aware-launch §3 — profile.url.mode === 'prefilled_locked' 면 자동 채움.
  useEffect(() => {
    if (!goalDef || !profile || !session?.pageId) return;
    if (state.landingUrl.trim() !== "") return;
    if (profile.url.mode !== "prefilled_locked") return;
    if (goalDef.defaultLink === "page_url") {
      dispatch({ type: "SET_LANDING_URL", value: `https://www.facebook.com/${session.pageId}` });
    } else if (goalDef.defaultLink === "messenger") {
      dispatch({ type: "SET_LANDING_URL", value: `https://m.me/${session.pageId}` });
    }
  }, [goalDef, profile, session?.pageId, state.landingUrl, dispatch]);

  const devModeOn = process.env.NEXT_PUBLIC_META_APP_MODE === "development";
  const testAccountId = process.env.NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID?.trim();
  const testAccountActive = devModeOn && !!testAccountId;

  const runLaunch = async (skipAdCreation: boolean) => {
    const imgToSend = state.finalImageDataUrl ?? state.imageDataUrl;
    if (!skipAdCreation && imgToSend) {
      const result = await validateAdImage(imgToSend);
      if (!result.ok) { showToast(result.reason); return; }
    }
    const params = buildLaunchParams(creative.state, state, { skipAdCreation, brandName });
    if (browseMode) {
      // ADR-033 — Browse Mode 시연 레이어. 목록 merge·상세 빨리감기가 이 레코드를 단일 소스로 사용.
      const plan = planBrowseLaunch(params, { brandName, ts: Date.now() });
      dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: plan.launched });
      saveLaunchedCampaign(plan.launched);
      // 둘러보기는 실 Gemini 이미지(수 MB base64)를 쓴다 — localStorage 용량 초과로 캠페인이 조용히 버려지지 않게 축소.
      const imageUrl = await shrinkImageDataUrl(plan.browseCampaign.imageUrl);
      createBrowseCampaign({ ...plan.browseCampaign, imageUrl });
      addNotification({ type: "launch", message: plan.message });
      if (state.autoRelaunchEnabled) setAutoRelaunch(plan.launched.campaignId, true);
      return;
    }
    launchMutation.mutate(params, {
      onSuccess: (data) => {
        const launched = buildLaunchedCampaign(data, params);
        dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
        saveLaunchedCampaign(launched);
        addNotification({ type: "launch", message: launchSuccessMessage(params) });
        if (state.autoRelaunchEnabled && data.campaignId) setAutoRelaunch(data.campaignId, true);
      },
    });
  };

  const [urlAttempted, setUrlAttempted] = useState(false);
  const [safetyIssues, setSafetyIssues] = useState<ValidationIssue[]>([]);
  const [pendingSkipAd, setPendingSkipAd] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const modalOpen = safetyIssues.length > 0;

  const hasCreative = creative.state.headline.trim().length > 0;
  const httpsOk = state.landingUrl.trim().startsWith("https://");
  const urlRequired = profile?.url.mode !== "hidden";

  const attemptLaunch = (skipAdCreation: boolean) => {
    setUrlAttempted(true);
    const invalidCard = firstInvalidCard({
      urlRequired,
      httpsOk,
      countriesCount: state.countries.length,
    });
    if (invalidCard) {
      document.getElementById(CARD_DOM_ID[invalidCard])?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const phaseObjective = outcomeChip && profile ? (outcomeChip as ObjectivePhase1Id) : null;
    const issues = validateLaunch({
      objective: phaseObjective,
      callSchedule: state.callSchedule,
      page: { pageId: session?.pageId ?? null, pageName: session?.pageName ?? null, phone: activePage?.phone ?? null },
    });
    if (issues.length === 0) { runLaunch(skipAdCreation); return; }
    setSafetyIssues(issues);
    setPendingSkipAd(skipAdCreation);
  };

  const handleLaunch = () => attemptLaunch(false);
  const handleSkipAdLaunch = () => attemptLaunch(true);
  const handleSafetyConfirm = () => { setSafetyIssues([]); runLaunch(pendingSkipAd); };
  const handleSafetyClose = () => setSafetyIssues([]);

  const blockReason = launchBlockReason({
    hasCreative,
    accountConnected,
    browseMode,
    countriesCount: state.countries.length,
    urlRequired,
    httpsOk,
    isPending: launchMutation.isPending,
    alreadyLaunched: !!state.launchedCampaign,
  });
  const canLaunch = !blockReason;
  const canSkipLaunch = (accountConnected || browseMode) && hasCreative && state.countries.length > 0 && !launchMutation.isPending && !state.launchedCampaign;

  if (state.launchedCampaign) {
    return <PostLaunchChecklist onRestart={onRestart} />;
  }

  if (isBoostPost) return <BoostPostFlow onNext={onNext} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ObjectivePicker goCreative={goCreative} />

        <Card variant="lg" id={CARD_DOM_ID.destination}>
          <DestinationField urlAttempted={urlAttempted} />
          {profile?.uniqueSections.includes("call_schedule") && (
            <><hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" /><CallScheduleSection /></>
          )}
          {profile?.uniqueSections.includes("messages_auto_reply") && (
            <><hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" /><MessagesAutoReplyCallout /></>
          )}
          {profile?.uniqueSections.includes("page_activity") && (
            <><hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" /><PageActivityCallout /></>
          )}
        </Card>

        <Card variant="lg">
          <BudgetScheduleStep />
        </Card>

        <Card variant="lg" id={CARD_DOM_ID.target}>
          <TargetStep />
        </Card>

        <Card variant="lg">
          <ABCreativeKnob />
        </Card>

        <Card variant="lg">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="w-full flex items-center justify-between gap-2 cursor-pointer bg-transparent border-none p-0"
          >
            <span className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">
              고급 설정
            </span>
            <Icon
              name="chev-down"
              size={16}
              className={advancedOpen ? "rotate-180" : ""}
              style={{ color: "var(--w-fg-alternative)", transition: "transform 160ms" }}
            />
          </button>
          {advancedOpen && (
            <>
              <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
              <DetailKnobs />
            </>
          )}
        </Card>
      </div>

      <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card variant="lg">
          <CreativePreview />
        </Card>
        <ConfirmStep
          canLaunch={canLaunch}
          canSkipLaunch={canSkipLaunch}
          onLaunch={handleLaunch}
          onSkipLaunch={handleSkipAdLaunch}
          mutation={launchMutation}
          goSettings={goSettings}
          devModeOn={devModeOn}
          testAccountActive={testAccountActive}
          blockReason={blockReason}
        />
        <SummaryCard />
      </div>

      {modalOpen && (
        <PreLaunchSafetyModal issues={safetyIssues} onClose={handleSafetyClose} onConfirm={handleSafetyConfirm} />
      )}
    </div>
  );
}
