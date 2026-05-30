"use client";

// STEP 02 광고 집행 widget — 모드 토글·디테일 분기·폼 입력·좌우 레이아웃 오케스트레이터.
// 각 서브스텝 패널은 별도 파일로 분리됨. page.tsx는 navigation 콜백 3개만 전달.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft, type LaunchParams, type LaunchResponse } from "@entities/campaign/model";
import { saveLaunchedCampaign } from "@entities/campaign/launched-storage";
import { createBrowseCampaign } from "@entities/campaign/browse/seed";
import type { MetaObjectiveParam } from "@/lib/meta-ads";
import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from "@entities/creative/options";
import { LAUNCH_PROFILES } from "@entities/launch-objective/profile";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { addNotification } from "@shared/lib/notifications";
import { useAutoRelaunch } from "@shared/lib/autoRelaunch";
import { useToast } from "@shared/ui/Toast";
import { validateAdImage, buildLaunchParams, buildLaunchedCampaign, launchSuccessMessage } from "@features/launch-campaign/build";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";

import ModeToggle from "./ModeToggle";
import ObjectivePicker from "./ObjectivePicker";
import DetailKnobs from "./DetailKnobs";
import DestinationField from "./DestinationField";
import CreativePreview from "./CreativePreview";
import SummaryCard from "./SummaryCard";
import LaunchStatusPanel from "./LaunchStatusPanel";
import CallScheduleSection from "./CallScheduleSection";
import MessagesAutoReplyCallout from "./MessagesAutoReplyCallout";
import PageActivityCallout from "./PageActivityCallout";
import PreLaunchSafetyModal from "./PreLaunchSafetyModal";
import SubStepIndicator from "./SubStepIndicator";
import BudgetScheduleStep from "./BudgetScheduleStep";
import TargetStep from "./TargetStep";
import ConfirmStep from "./ConfirmStep";
import BoostPostFlow from "./BoostPostFlow";
import { validateLaunch, type ValidationIssue } from "@features/launch-validation";

interface Props {
  onNext: () => void;
  goSettings: () => void;
  /** PRD §5.4.1 — 디테일에서 목표 변경했을 때 STEP 01 카피 다시 만들기 링크 (Q6 결정). */
  goCreative: () => void;
  brandName?: string;
}

export default function LaunchStep({ onNext, goSettings, goCreative, brandName }: Props) {
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const state = launch.state;
  const dispatch = launch.dispatch;
  const { setEnabled: setAutoRelaunch } = useAutoRelaunch();

  // STEP 02 진입 시 — STEP 01 AI가 채운 타겟팅으로 연령·성별 prefill.
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
  const isBoostPost = outcomeChip === "boost_post";
  const goalDef = outcomeChip ? OBJECTIVES_PHASE1.find((g) => g.id === outcomeChip) : null;
  const profile = outcomeChip && outcomeChip in LAUNCH_PROFILES
    ? LAUNCH_PROFILES[outcomeChip as ObjectivePhase1Id]
    : null;

  // PRD-objective-aware-launch §5.2 — 목표 변경 시 호환 보존·종속 리셋 + toast.
  const prevOutcomeRef = useRef(outcomeChip);
  useEffect(() => {
    const prev = prevOutcomeRef.current;
    if (prev === outcomeChip) return;
    prevOutcomeRef.current = outcomeChip;
    if (prev === null || outcomeChip === null) return;
    dispatch({ type: "MIGRATE_FOR_OBJECTIVE_CHANGE" });
    const prevLabel = OBJECTIVES_PHASE1.find((o) => o.id === prev)?.label ?? prev;
    const nextLabel = OBJECTIVES_PHASE1.find((o) => o.id === outcomeChip)?.label ?? outcomeChip;
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
    if (!skipAdCreation && state.imageDataUrl) {
      const result = await validateAdImage(state.imageDataUrl);
      if (!result.ok) { showToast(result.reason); return; }
    }
    const params = buildLaunchParams(creative.state, state, { skipAdCreation, brandName });
    if (browseMode) {
      const ts = Date.now();
      const abEnabled = !!params.abTestEnabled && !!params.abTestAxis && !!params.abTestVariantB;
      const mock = {
        campaignId: `cmp_browse_${ts}`,
        adSetId: `adset_browse_${ts}`,
        ...(abEnabled
          ? { adIds: [`ad_browse_${ts}_a`, `ad_browse_${ts}_b`] as [string, string] }
          : skipAdCreation ? {} : { adId: `ad_browse_${ts}` }),
      };
      const launched = buildLaunchedCampaign(mock, params);
      dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
      saveLaunchedCampaign(launched);
      // ADR-033 — Browse Mode 시연 레이어. 목록 merge·상세 빨리감기가 이 레코드를 단일 소스로 사용.
      const BROWSE_OBJECTIVES = new Set<MetaObjectiveParam>(["OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS"]);
      const objective = BROWSE_OBJECTIVES.has(params.objective as MetaObjectiveParam) ? (params.objective as MetaObjectiveParam) : "OUTCOME_TRAFFIC";
      createBrowseCampaign({
        id: mock.campaignId,
        name: `${(brandName ?? "내 캠페인").trim()} — ${params.headline}`,
        headline: params.headline,
        primaryText: params.primaryText,
        cta: params.cta,
        imageUrl: params.imageDataUrl ?? "",
        objective,
        dailyBudget: params.dailyBudget,
        startDate: params.startDate,
        ageMin: params.ageMin,
        ageMax: params.ageMax,
        genders: params.genders,
        countries: params.countries,
      });
      addNotification({ type: "launch", message: launchSuccessMessage(params) });
      if (state.autoRelaunchEnabled) setAutoRelaunch(mock.campaignId, true);
      // 둘러보기 모드 — 기술적 ID 패널을 건너뛰고 바로 STEP 03 마무리 점검으로.
      onNext();
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

  const [safetyIssues, setSafetyIssues] = useState<ValidationIssue[]>([]);
  const [pendingSkipAd, setPendingSkipAd] = useState(false);
  const modalOpen = safetyIssues.length > 0;

  const attemptLaunch = (skipAdCreation: boolean) => {
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

  const skipAd = state.mode === "simple";
  const handleLaunch = () => attemptLaunch(skipAd);
  const handleSkipAdLaunch = () => attemptLaunch(true);
  const handleSafetyConfirm = () => { setSafetyIssues([]); runLaunch(pendingSkipAd); };
  const handleSafetyClose = () => setSafetyIssues([]);

  const hasCreative = creative.state.headline.trim().length > 0;
  const httpsOk = state.landingUrl.trim().startsWith("https://");
  const baseLaunchOk = (accountConnected || browseMode) && hasCreative && state.countries.length > 0 && !launchMutation.isPending && !state.launchedCampaign;
  const urlRequired = profile?.url.mode !== "hidden";
  const canLaunch = baseLaunchOk && (skipAd || !urlRequired || httpsOk);
  const canSkipLaunch = baseLaunchOk;

  const [subStep, setSubStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [modeConfirmed, setModeConfirmed] = useState(false);
  const subSteps = state.mode === "detailed"
    ? [{ n: 1, label: "소재 확인" }, { n: 2, label: "예산 · 일정" }, { n: 3, label: "타겟" }, { n: 4, label: "고급 설정" }, { n: 5, label: "최종 확인" }]
    : [{ n: 1, label: "소재 확인" }, { n: 2, label: "예산 · 일정" }, { n: 3, label: "타겟" }, { n: 4, label: "최종 확인" }];

  if (isBoostPost) return <BoostPostFlow onNext={onNext} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "flex-start" }}>
      <Card variant="lg">
        {!modeConfirmed ? (
          <>
            <div className="mb-4">
              <p className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)] mb-1">집행 방식을 선택해 주세요</p>
              <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">나중에도 변경할 수 있어요.</p>
            </div>
            <ModeToggle />
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <Button variant="primary" size="lg" type="button" onClick={() => setModeConfirmed(true)} style={{ minWidth: 240 }}>
                다음
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[13px] text-[var(--w-fg-neutral)]">집행 방식</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] font-semibold text-[12px]">
                  {state.mode === "simple" ? "간단 설정" : "디테일 설정"}
                </span>
              </div>
              <button
                type="button"
                className="font-medium text-[12px] text-[var(--w-fg-neutral)] underline underline-offset-2 cursor-pointer"
                onClick={() => setModeConfirmed(false)}
              >
                변경
              </button>
            </div>
            <SubStepIndicator steps={subSteps} current={subStep} onStepClick={(n) => setSubStep(n as 1 | 2 | 3 | 4 | 5)} />
            <hr className="h-px bg-[var(--w-line-neutral)] border-0" style={{ margin: "0 0 20px" }} />

            {subStep === 1 && (
              <>
                <CreativePreview />
                <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
                <DestinationField />
                {profile?.uniqueSections.includes("call_schedule") && (
                  <><hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" /><CallScheduleSection /></>
                )}
                {profile?.uniqueSections.includes("messages_auto_reply") && (
                  <><hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" /><MessagesAutoReplyCallout /></>
                )}
                {profile?.uniqueSections.includes("page_activity") && (
                  <><hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" /><PageActivityCallout /></>
                )}
                <div className="flex items-center justify-between gap-3" style={{ marginTop: 24 }}>
                  <Button variant="secondary" type="button" onClick={() => setModeConfirmed(false)}>
                    이전
                  </Button>
                  <Button variant="primary" type="button" onClick={() => setSubStep(2)}>
                    다음
                  </Button>
                </div>
              </>
            )}

            {subStep === 2 && (
              <BudgetScheduleStep onBack={() => setSubStep(1)} onNext={() => setSubStep(3)} />
            )}

            {subStep === 3 && (
              <TargetStep onBack={() => setSubStep(2)} onNext={() => setSubStep(4)} />
            )}

            {subStep === 4 && state.mode === "detailed" && (
              <>
                <ObjectivePicker goCreative={goCreative} />
                <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
                <DetailKnobs />
                <div className="flex items-center justify-between gap-3" style={{ marginTop: 24 }}>
                  <Button variant="secondary" type="button" onClick={() => setSubStep(3)}>
                    이전
                  </Button>
                  <Button variant="primary" type="button" onClick={() => setSubStep(5)}>
                    다음
                  </Button>
                </div>
              </>
            )}

            {((subStep === 4 && state.mode !== "detailed") || subStep === 5) && (
              <ConfirmStep
                onBack={() => setSubStep(state.mode === "detailed" ? 4 : 3)}
                canLaunch={canLaunch}
                canSkipLaunch={canSkipLaunch}
                onLaunch={handleLaunch}
                onSkipLaunch={handleSkipAdLaunch}
                mutation={launchMutation}
                goSettings={goSettings}
                devModeOn={devModeOn}
                testAccountActive={testAccountActive}
              />
            )}
          </>
        )}
      </Card>

      <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <LaunchStatusPanel mutation={launchMutation} onNext={onNext} />
        <SummaryCard />
      </div>

      {modalOpen && (
        <PreLaunchSafetyModal issues={safetyIssues} onClose={handleSafetyClose} onConfirm={handleSafetyConfirm} />
      )}
    </div>
  );
}
