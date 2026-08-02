"use client";

// STEP 03 게재 — 시안 1e. 좌: 확정한 소재, 우: 채널·예산·기간·예상 성과 + 검수 요청.
// 시안에 없지만 게재에 반드시 필요한 것(도착 링크·타겟·A/B·고급)은 "세부 설정"으로 접어 둔다 —
// 평소 화면은 시안 그대로, 필요할 때만 펼친다.
// 게재 성공(state.launchedCampaign) 시 같은 자리가 시안 2c(검수 요청됨) 로 전환.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft, type LaunchParams, type LaunchResponse } from "@entities/campaign/model";
import { adIdentityPagesQueryKey, fetchAdIdentityPages } from "@entities/page/api";
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
import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import DatePicker from "@shared/ui/DatePicker";
import Icon from "@shared/ui/Icon";
import { fmt } from "@shared/lib/format";
import { fmtBudget } from "@shared/lib/launch-utils";
import { calcDaysBetween, estimateImpressionRange } from "@entities/insights/budget-estimates";
import { CTA_LABEL } from "@entities/creative/options";
import { AdMockFull } from "@widgets/create-flow/AdMockup";
import { PanelCard, SelectChip } from "@widgets/create-flow/parts";
import { useBrandHandle } from "@widgets/create-flow/useBrandHandle";

import DetailKnobs from "./DetailKnobs";
import ABCreativeKnob from "./ABCreativeKnob";
import DestinationField from "./DestinationField";
import CallScheduleSection from "./CallScheduleSection";
import MessagesAutoReplyCallout from "./MessagesAutoReplyCallout";
import PageActivityCallout from "./PageActivityCallout";
import PreLaunchSafetyModal from "./PreLaunchSafetyModal";
import TargetStep from "./TargetStep";
import BoostPostFlow from "./BoostPostFlow";
import ReviewRequestedCard from "./ReviewRequestedCard";
import { validateLaunch, type ValidationIssue } from "@features/launch-validation";

const BUDGET_MIN = 10_000;
const BUDGET_MAX = 100_000;
const BUDGET_STEP = 5_000;

// 시안 1e 의 게재 채널 칩 3개 ↔ Meta placement position.
const CHANNELS = [
  { id: "instagram_feed", label: "인스타그램 피드", platform: "instagram" as const },
  { id: "instagram_stories", label: "스토리", platform: "instagram" as const },
  { id: "facebook_feed", label: "페이스북", platform: "facebook" as const },
] as const;

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
  const handle = useBrandHandle();

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
  const { data: pages } = useQuery({
    queryKey: adIdentityPagesQueryKey,
    queryFn: fetchAdIdentityPages,
    enabled: !!session?.pageId,
  });
  const activePage = pages?.find((p) => p.id === session?.pageId);

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
      // 도착 링크·타겟은 "세부 설정" 안에 접혀 있다 — 펼쳐야 스크롤할 자리가 생긴다.
      setAdvancedOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(CARD_DOM_ID[invalidCard])?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
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

  if (state.launchedCampaign) return <ReviewRequestedCard onRestart={onRestart} />;

  if (isBoostPost) return <BoostPostFlow onNext={onNext} />;

  const budgetNum = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
  const days = calcDaysBetween(state.dateStart, state.dateEnd);
  const { min: impMin, max: impMax } = estimateImpressionRange(budgetNum, days);
  const sliderValue = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, budgetNum || BUDGET_MIN));
  const budgetPct = ((sliderValue - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;

  const positions = state.placements.mode === "manual" ? state.placements.positions : [];
  const channelOn = (id: string) => state.placements.mode === "auto" || positions.includes(id);

  // 칩 하나를 끄고 켤 때마다 placements(수동 위치) 와 platforms 를 함께 맞춘다.
  // 전부 끄면 자동 게재 위치로 돌아간다 — Meta 에 빈 목록을 보내지 않으려고.
  const toggleChannel = (id: string) => {
    const base = state.placements.mode === "auto" ? CHANNELS.map((c) => c.id as string) : positions;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length === 0) {
      dispatch({ type: "SET_PLACEMENTS", placements: { mode: "auto" } });
      dispatch({ type: "SET_PLATFORMS", platforms: "both" });
      return;
    }
    dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: next } });
    const platforms = CHANNELS.filter((c) => next.includes(c.id));
    const hasFb = platforms.some((c) => c.platform === "facebook");
    const hasIg = platforms.some((c) => c.platform === "instagram");
    dispatch({ type: "SET_PLATFORMS", platforms: hasFb && hasIg ? "both" : hasFb ? "facebook" : "instagram" });
  };

  return (
    <div className="bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] overflow-hidden">
      <div className="px-7 pt-6 pb-3">
        <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] mb-1">
          광고 만들기 · STEP 03
        </div>
        <h1 className="m-0 font-bold text-[26px] leading-[1.35] tracking-[-0.02em] text-[var(--w-fg-strong)]">
          언제, 얼마나 보여줄까요
        </h1>
      </div>

      <div className="flex gap-5 items-start px-7 pt-2 pb-6">
        <PanelCard className="w-[392px] shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--w-line-alternative)]">
            <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">확정한 소재</span>
            <button
              type="button"
              onClick={goCreative}
              className="font-medium text-[12px] leading-[1.4] text-[var(--w-primary-normal)] cursor-pointer"
            >
              소재 수정
            </button>
          </div>
          <AdMockFull
            handle={handle}
            imageUrl={state.finalImageDataUrl ?? state.imageDataUrl}
            imageHeight={300}
            headline={creative.state.headline}
            body={creative.state.primaryText}
            ctaLabel={CTA_LABEL[creative.state.cta]}
          />
        </PanelCard>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <PanelCard className="p-[18px]">
            <div className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)] mb-2.5">게재 채널</div>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map((c) => (
                <SelectChip key={c.id} active={channelOn(c.id)} onClick={() => toggleChannel(c.id)}>
                  {c.label}
                </SelectChip>
              ))}
            </div>
            {state.placements.mode === "auto" && (
              <p className="m-0 mt-2.5 font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
                지금은 자동 게재 위치예요 — Meta 가 성과가 좋은 곳에 알아서 배분해요.
              </p>
            )}
          </PanelCard>

          <PanelCard className="p-[18px]">
            <div className="flex items-baseline justify-between mb-3">
              <span className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">하루 예산</span>
              <span className="font-bold text-[20px] leading-[1.3] text-[var(--w-primary-normal)]">
                {fmt(budgetNum)}원
              </span>
            </div>
            <input
              type="range"
              className="w-range block"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              value={sliderValue}
              aria-label="하루 예산"
              onChange={(e) => dispatch({ type: "SET_BUDGET", value: fmtBudget(e.target.value) })}
              style={{
                background: `linear-gradient(to right, var(--w-primary-normal) 0 ${budgetPct}%, var(--w-fill-normal) ${budgetPct}% 100%)`,
              }}
            />
            <div className="flex justify-between mt-2 font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">
              <span>1만원</span>
              <span>10만원</span>
            </div>
          </PanelCard>

          <PanelCard className="p-[18px]">
            <div className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)] mb-2.5">게재 기간</div>
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <DatePicker
                  value={state.dateStart}
                  onChange={(v) => dispatch({ type: "SET_DATE_START", value: v })}
                  placeholder="시작일"
                  aria-label="시작일"
                />
              </div>
              <span className="text-[var(--w-fg-alternative)]">–</span>
              <div className="flex-1 min-w-0">
                <DatePicker
                  value={state.dateEnd}
                  onChange={(v) => dispatch({ type: "SET_DATE_END", value: v })}
                  placeholder="종료일"
                  aria-label="종료일"
                />
              </div>
              <Chip variant="neutral">{days}일</Chip>
            </div>
          </PanelCard>

          <div className="bg-[var(--w-primary-soft)] rounded-[var(--w-radius-12)] p-[18px]">
            <div className="font-semibold text-[13px] leading-[1.4] text-[var(--w-primary-normal)] mb-2.5">예상 성과</div>
            <div className="flex gap-7 flex-wrap">
              <div>
                <div className="font-bold text-[24px] leading-[1.3] text-[var(--w-fg-strong)]">
                  {fmt(impMin)}–{fmt(impMax)}
                </div>
                <div className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">예상 노출</div>
              </div>
              <div>
                <div className="font-bold text-[24px] leading-[1.3] text-[var(--w-fg-strong)]">{days}일</div>
                <div className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">게재 기간</div>
              </div>
              <div>
                <div className="font-bold text-[24px] leading-[1.3] text-[var(--w-fg-strong)]">
                  {fmt(budgetNum * days)}원
                </div>
                <div className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">총 집행액</div>
              </div>
            </div>
            <p className="m-0 mt-2.5 font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
              업계 평균 CPM 을 가정해 대략 추정한 값이에요. 실제 노출은 경쟁·소재 성과에 따라 달라져요.
            </p>
          </div>

          <PanelCard className="p-[18px]">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="w-full flex items-center justify-between gap-2 cursor-pointer bg-transparent border-none p-0"
            >
              <span className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">세부 설정</span>
              <span className="flex items-center gap-2">
                <span className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">
                  도착 링크 · 타겟 · A/B · 고급
                </span>
                <Icon
                  name="chev-down"
                  size={16}
                  className={advancedOpen ? "rotate-180" : ""}
                  style={{ color: "var(--w-fg-alternative)", transition: "transform 160ms" }}
                />
              </span>
            </button>
            {advancedOpen && (
              <div className="flex flex-col gap-[18px] mt-[18px]">
                <div id={CARD_DOM_ID.destination}>
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
                </div>
                <hr className="h-px bg-[var(--w-line-neutral)] border-0" />
                <div id={CARD_DOM_ID.target}><TargetStep /></div>
                <hr className="h-px bg-[var(--w-line-neutral)] border-0" />
                <ABCreativeKnob />
                <hr className="h-px bg-[var(--w-line-neutral)] border-0" />
                <DetailKnobs />
              </div>
            )}
          </PanelCard>

          {blockReason && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[var(--w-radius-12)] bg-[var(--w-status-cautionary-soft)]">
              <Icon name="warn" size={15} className="shrink-0 mt-0.5 text-[var(--w-status-cautionary)]" />
              <p className="m-0 font-medium text-[13px] leading-[1.6] text-[var(--w-fg-normal)]">{blockReason}</p>
            </div>
          )}
          {!accountConnected && !browseMode && (
            <button
              type="button"
              onClick={goSettings}
              className="self-start font-medium text-[13px] text-[var(--w-primary-normal)] cursor-pointer"
            >
              계정 연결하러 가기 ›
            </button>
          )}

          <div className="flex justify-end gap-2.5">
            {devModeOn && testAccountActive && (
              <Button variant="ghost" size="lg" type="button" onClick={handleSkipAdLaunch} disabled={!canSkipLaunch}>
                광고 없이 캠페인만 만들기
              </Button>
            )}
            <Button variant="secondary" size="lg" type="button" onClick={goCreative}>
              ← 소재로
            </Button>
            <Button variant="primary" size="lg" type="button" onClick={handleLaunch} disabled={!canLaunch}>
              {launchMutation.isPending ? "요청하는 중…" : "검수 요청하기"}
            </Button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <PreLaunchSafetyModal issues={safetyIssues} onClose={handleSafetyClose} onConfirm={handleSafetyConfirm} />
      )}
    </div>
  );
}
