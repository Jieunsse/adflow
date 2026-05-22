"use client";

// STEP 02 광고 집행 widget. ADR-001 §"후속 결정" deepening ③.
// 이 파일은 폼 레이아웃 오케스트레이터 — 모드 토글, 디테일 분기, 폼 입력(랜딩 URL · 예산 · 일정 · 타겟 · 게재 상태),
// 좌측 카드(설정) + 우측 컬럼(상태 + 요약) 의 자리 잡기. 각 노브/카드/패널은 sub-component 가 자기 슬라이스 hook 으로 접근.
//
// page.tsx 는 navigation 콜백 3 개만 전달:
//   - onNext     → STEP 03 으로
//   - goSettings → /setup (계정 연결 페이지)
//   - goCreative → STEP 01 로 (카피 부합성 callout 의 링크용)

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import AgeRange from "@shared/ui/AgeRange";
import { fmt } from "@shared/lib/format";
import { fmtBudget } from "@shared/lib/launch-utils";
import { COUNTRIES } from "@shared/lib/geo-options";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft, type LaunchParams, type LaunchResponse, type LaunchedCampaign } from "@entities/campaign/model";
import { saveLaunchedCampaign } from "@entities/campaign/launched-storage";
import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from "@entities/creative/options";
import { LAUNCH_PROFILES } from "@entities/launch-objective/profile";
import { type Gender } from "@shared/lib/meta/targeting";
import { calcDaysBetween, estimateImpressionRange } from "@entities/insights/budget-estimates";
import { addNotification } from "@shared/lib/notifications";
import { useAutoRelaunch } from "@shared/lib/autoRelaunch";
import { useToast } from "@shared/ui/Toast";
import { validateAdImage, buildLaunchParams, buildLaunchedCampaign, launchSuccessMessage } from "@features/launch-campaign/build";
import { cn } from "@shared/lib/cn";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";

import DatePicker from "@shared/ui/DatePicker";
import BoostPostKnob, { type IgMediaItem } from "./BoostPostKnob";
import SubHead from "./SubHead";
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
import { validateLaunch, type ValidationIssue } from "@features/launch-validation";

const GENDER_OPTS: [Gender, string][] = [["all", "전체"], ["male", "남성"], ["female", "여성"]];

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";
const chipAccent = "border-[var(--w-primary-normal)] text-[var(--w-primary-press)] bg-[var(--w-primary-soft)]";

interface Props {
  onNext: () => void;
  goSettings: () => void;
  /** PRD §5.4.1 — 디테일에서 목표 변경했을 때 STEP 01 카피 다시 만들기 링크 (Q6 결정). */
  goCreative: () => void;
}

export default function LaunchStep({ onNext, goSettings, goCreative }: Props) {
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const state = launch.state;
  const dispatch = launch.dispatch;
  const { setEnabled: setAutoRelaunch } = useAutoRelaunch();

  // STEP 02 진입 시 — STEP 01 AI 가 채운 타겟팅으로 연령·성별 prefill. 매핑 규칙은 LaunchDraft reducer.
  const targeting = creative.state.targeting;
  useEffect(() => {
    if (!targeting) return;
    dispatch({ type: "APPLY_CREATIVE_TARGETING", targeting });
  }, [targeting, dispatch]);

  // 외부 정보 — 세션·집행 mutation.
  const router = useRouter();
  const { data: session } = useSession();
  const accountConnected = !!(session?.adAccountId && session?.pageId);
  const browseMode = !!session?.browseMode;
  const launchMutation = useApiMutation<LaunchParams, LaunchResponse>("/api/campaign");
  const boostMutation = useApiMutation<object, LaunchResponse>("/api/boost-post");
  const showToast = useToast();

  // PRD §13.10 — single-select. outcome 의 goal entry. STEP 02 link prefill + 전화 받기 page phone 검증 source.
  const outcomeChip = creative.state.outcome;
  const isBoostPost = outcomeChip === "boost_post";
  const goalDef = outcomeChip ? OBJECTIVES_PHASE1.find((g) => g.id === outcomeChip) : null;
  const profile = outcomeChip && outcomeChip in LAUNCH_PROFILES
    ? LAUNCH_PROFILES[outcomeChip as ObjectivePhase1Id]
    : null;

  // PRD-objective-aware-launch §5.2 — 목표 변경 시 호환 보존·종속 리셋 + toast.
  // outcome 이 *바뀐 시점만* 트리거 (마운트 시 ref 가 첫 값 캡쳐).
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

  // 페이지 목록 — 활성 페이지의 phone 확인 (leads_call goal 사전 차단용).
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
  const phoneMissingForCall = goalDef?.id === "leads_call" && activePage !== undefined && !activePage.phone;

  // PRD-objective-aware-launch §3 — profile.url.mode === 'prefilled_locked' 면 자동 채움.
  // 유저가 이미 입력했으면 덮어쓰지 않음. defaultLink 가 page_url/messenger 인지로 URL 형태 분기.
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

  // Meta App 개발 모드 호환 — env flag 가 development 일 때만 callout 노출.
  // 테스트 광고 계정이 셋팅돼있으면 전체 플로우(Creative/Ad 포함) 가 실호출되니
  // skip 버튼은 숨기고 안내 메시지만 표시.
  const devModeOn = process.env.NEXT_PUBLIC_META_APP_MODE === "development";
  const testAccountId = process.env.NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID?.trim();
  const testAccountActive = devModeOn && !!testAccountId;

  const runLaunch = async (skipAdCreation: boolean) => {
    if (!skipAdCreation && state.imageDataUrl) {
      const result = await validateAdImage(state.imageDataUrl);
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
    }
    const params = buildLaunchParams(creative.state, state, { skipAdCreation });
    if (browseMode) {
      const ts = Date.now();
      const abEnabled = !!params.abTestEnabled && !!params.abTestAxis && !!params.abTestVariantB;
      const mock: LaunchResponse = {
        campaignId: `cmp_browse_${ts}`,
        adSetId: `adset_browse_${ts}`,
        ...(abEnabled
          ? { adIds: [`ad_browse_${ts}_a`, `ad_browse_${ts}_b`] as [string, string] }
          : skipAdCreation ? {} : { adId: `ad_browse_${ts}` }),
      };
      const launched = buildLaunchedCampaign(mock, params);
      dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
      saveLaunchedCampaign(launched);
      addNotification({ type: "launch", message: launchSuccessMessage(params) });
      if (state.autoRelaunchEnabled) setAutoRelaunch(mock.campaignId, true);
      return;
    }
    launchMutation.mutate(params, {
      onSuccess: (data) => {
        const launched = buildLaunchedCampaign(data, params);
        dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
        saveLaunchedCampaign(launched);
        addNotification({ type: "launch", message: launchSuccessMessage(params) });
        if (state.autoRelaunchEnabled && data.campaignId) {
          setAutoRelaunch(data.campaignId, true);
        }
      },
    });
  };

  // PRD-objective-aware-launch §5.1 — 게재 직전 검증. 이슈 있으면 모달, 없으면 바로 launch.
  const [safetyIssues, setSafetyIssues] = useState<ValidationIssue[]>([]);
  const [pendingSkipAd, setPendingSkipAd] = useState(false);
  const modalOpen = safetyIssues.length > 0;

  const attemptLaunch = (skipAdCreation: boolean) => {
    const phaseObjective = outcomeChip && profile ? (outcomeChip as ObjectivePhase1Id) : null;
    const issues = validateLaunch({
      objective: phaseObjective,
      callSchedule: state.callSchedule,
      page: {
        pageId: session?.pageId ?? null,
        pageName: session?.pageName ?? null,
        phone: activePage?.phone ?? null,
      },
    });
    if (issues.length === 0) {
      runLaunch(skipAdCreation);
      return;
    }
    setSafetyIssues(issues);
    setPendingSkipAd(skipAdCreation);
  };

  // 간단 설정 = Ad Creative · Ad 없이 캠페인 + 세트만 생성. 디테일은 풀 플로우 유지.
  const skipAd = state.mode === "simple";
  const handleLaunch = () => attemptLaunch(skipAd);
  const handleSkipAdLaunch = () => attemptLaunch(true);
  const handleSafetyConfirm = () => {
    setSafetyIssues([]);
    runLaunch(pendingSkipAd);
  };
  const handleSafetyClose = () => setSafetyIssues([]);

  // 파생값 — UI 표시·집행 가능 조건.
  const budgetNum = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
  const days = calcDaysBetween(state.dateStart, state.dateEnd);
  const { min: impMin, max: impMax } = estimateImpressionRange(budgetNum, days);
  const httpsOk = state.landingUrl.trim().startsWith("https://");
  const hasCreative = creative.state.headline.trim().length > 0;
  const baseLaunchOk = (accountConnected || browseMode) && hasCreative && state.countries.length > 0 && !launchMutation.isPending && !state.launchedCampaign;
  // PRD-objective-aware-launch §3·§5.1 — URL https 만 inline 게이트. 나머지(phone·시간대·메신저·페이지 활성도)는 PreLaunchSafetyModal 에서.
  // hidden 인 목표(awareness, leads_call) 는 URL 형식 검증 불필요. user_input/prefilled_locked 는 https 필수.
  const urlRequired = profile?.url.mode !== "hidden";
  const canLaunch = baseLaunchOk && (skipAd || !urlRequired || httpsOk);
  const canSkipLaunch = baseLaunchOk;

  // PRD-branded-content.md — boost_post 전용 로컬 상태. 세션 손실 시 재선택하면 됨(V1 허용).
  const [boostGoal, setBoostGoal] = useState<'engagement' | 'profile' | 'website' | 'message'>('engagement');
  const [boostLandingUrl, setBoostLandingUrl] = useState('');
  const [boostMedia, setBoostMedia] = useState<IgMediaItem | null>(null);
  const [boostSubStep, setBoostSubStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const runBoostLaunch = () => {
    if (!boostMedia) { showToast("홍보할 게시물을 선택해주세요."); return; }
    const budgetNum = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
    if (budgetNum < 10000) { showToast("일일 예산은 최소 ₩10,000 이상이어야 해요."); return; }
    if (state.countries.length === 0) { showToast("타겟 지역을 최소 한 곳 선택해주세요."); return; }
    if (boostGoal === 'website' && !boostLandingUrl.trim().startsWith('https://')) { showToast("웹사이트 URL은 https://로 시작해야 해요."); return; }

    const genders: number[] = state.gender === "male" ? [1] : state.gender === "female" ? [2] : [];
    const body = {
      igMediaId: boostMedia.id,
      dailyBudget: budgetNum,
      startDate: state.dateStart,
      endDate: state.dateEnd,
      ageMin: state.ageMin,
      ageMax: state.ageMax,
      genders,
      countries: state.countries,
      status: state.delivery,
      boostGoal,
      ...(boostGoal === 'website' ? { landingUrl: boostLandingUrl } : {}),
    };

    if (browseMode) {
      const ts = Date.now();
      const campaignId = `cmp_boost_browse_${ts}`;
      try {
        localStorage.setItem(`adflow:boost-post:${campaignId}`, JSON.stringify({ igMediaId: boostMedia.id, igMediaThumbnailUrl: boostMedia.mediaUrl }));
      } catch { /* localStorage 사용 불가 */ }
      const launched: LaunchedCampaign = { campaignId, adSetId: `adset_boost_${ts}`, adId: `ad_boost_${ts}`, dailyBudget: budgetNum, startDate: state.dateStart, endDate: state.dateEnd, status: state.delivery, objective: "OUTCOME_ENGAGEMENT", goalId: "boost_post" };
      dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
      saveLaunchedCampaign(launched);
      return;
    }

    boostMutation.mutate(body, {
      onSuccess: (data) => {
        if (!data.campaignId) return;
        try {
          localStorage.setItem(`adflow:boost-post:${data.campaignId}`, JSON.stringify({ igMediaId: boostMedia.id, igMediaThumbnailUrl: boostMedia.mediaUrl }));
        } catch { /* localStorage 사용 불가 */ }
        const launched: LaunchedCampaign = { campaignId: data.campaignId, adSetId: data.adSetId, adId: data.adId, dailyBudget: budgetNum, startDate: state.dateStart, endDate: state.dateEnd, status: state.delivery, objective: "OUTCOME_ENGAGEMENT", goalId: "boost_post" };
        dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
        saveLaunchedCampaign(launched);
      },
    });
  };

  const [subStep, setSubStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const subSteps: Array<{ n: 1|2|3|4|5; label: string }> = state.mode === "detailed"
    ? [
        { n: 1, label: "소재 확인" },
        { n: 2, label: "예산 · 일정" },
        { n: 3, label: "타겟" },
        { n: 4, label: "고급 설정" },
        { n: 5, label: "최종 확인" },
      ]
    : [
        { n: 1, label: "소재 확인" },
        { n: 2, label: "예산 · 일정" },
        { n: 3, label: "타겟" },
        { n: 4, label: "최종 확인" },
      ];

  const toggleCountry = (code: string) => {
    const next = state.countries.includes(code)
      ? state.countries.filter((c) => c !== code)
      : [...state.countries, code];
    dispatch({ type: "SET_COUNTRIES", value: next });
  };

  // PRD-branded-content.md — boost_post 전용 UI (STEP 02 분기).
  if (isBoostPost) {
    const budgetNum = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
    const genders: number[] = state.gender === "male" ? [1] : state.gender === "female" ? [2] : [];
    const boostSubSteps: Array<{ n: 1|2|3|4|5; label: string }> = [
      { n: 1, label: "홍보 방식" },
      { n: 2, label: "게시물 선택" },
      { n: 3, label: "예산 · 일정" },
      { n: 4, label: "타겟" },
      { n: 5, label: "최종 확인" },
    ];
    const canBoostLaunch = !boostMutation.isPending && !state.launchedCampaign && !!boostMedia && budgetNum >= 10000 && state.countries.length > 0 && (boostGoal !== 'website' || boostLandingUrl.trim().startsWith('https://'));
    const boostGoalLabel = { engagement: '더 많은 참여 유도', profile: '프로필 방문 늘리기', website: '웹사이트 방문 유도', message: '메시지 받기' }[boostGoal];

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "flex-start" }}>
        <Card variant="lg">
          {/* 서브스텝 인디케이터 */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
            {boostSubSteps.map((s, i) => {
              const done = s.n < boostSubStep;
              const active = s.n === boostSubStep;
              return (
                <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < boostSubSteps.length - 1 ? 1 : undefined }}>
                  <button type="button" onClick={() => setBoostSubStep(s.n)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: active || done ? "var(--w-accent-violet)" : "transparent", border: `2px solid ${active || done ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`, color: active || done ? "#fff" : "var(--w-fg-neutral)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 11px/1 var(--w-font-sans)" }}>
                      {done ? <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> : s.n}
                    </span>
                    <span style={{ font: `${active ? "600" : "500"} 13px/1 var(--w-font-sans)`, color: active ? "var(--w-accent-violet)" : done ? "var(--w-fg-normal)" : "var(--w-fg-neutral)", whiteSpace: "nowrap" }}>{s.label}</span>
                  </button>
                  {i < boostSubSteps.length - 1 && <div style={{ flex: 1, height: 1, background: done ? "var(--w-accent-violet)" : "var(--w-line-normal)", margin: "0 10px" }} />}
                </div>
              );
            })}
          </div>
          <hr className="h-px bg-[var(--w-line-neutral)] border-0" style={{ margin: "0 0 20px" }} />

          {/* 1단계: 홍보 방식 */}
          {boostSubStep === 1 && (
            <>
              <SubHead title="홍보 방식 선택" subtitle="이 게시물로 어떤 목표를 달성하고 싶으신가요?" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {([
                  { id: 'engagement', label: '더 많은 참여 유도', desc: '좋아요·댓글·공유 등 게시물 반응을 늘려요.' },
                  { id: 'profile', label: '프로필 방문 늘리기', desc: '광고를 보고 프로필 페이지를 방문하도록 유도해요.' },
                  { id: 'website', label: '웹사이트 방문 유도', desc: '랜딩 페이지로 트래픽을 보내요. URL 입력이 필요해요.' },
                  { id: 'message', label: '메시지 받기', desc: 'DM으로 잠재 고객과 대화를 시작해요.' },
                ] as const).map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBoostGoal(id)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
                      border: `1.5px solid ${boostGoal === id ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
                      borderRadius: 12,
                      background: boostGoal === id ? "color-mix(in srgb, var(--w-accent-violet) 6%, transparent)" : "var(--w-bg-elevated)",
                      cursor: "pointer", textAlign: "left", width: "100%",
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: `2px solid ${boostGoal === id ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`, background: boostGoal === id ? "var(--w-accent-violet)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {boostGoal === id && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                    </span>
                    <div>
                      <p style={{ margin: 0, font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{label}</p>
                      <p style={{ margin: "3px 0 0", font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              {boostGoal === 'website' && (
                <div style={{ marginTop: 16 }}>
                  <SubHead title="랜딩 페이지 URL" />
                  <input
                    className="border border-[var(--w-line-normal)] rounded-xl px-[14px] py-3 w-full bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] transition-[border-color,box-shadow] duration-[120ms]"
                    value={boostLandingUrl}
                    onChange={(e) => setBoostLandingUrl(e.target.value)}
                    placeholder="https://example.com/landing"
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <Button variant="primary" type="button" disabled={boostGoal === 'website' && !boostLandingUrl.trim().startsWith('https://')} onClick={() => setBoostSubStep(2)}>
                  다음 <Icon name="arrow-right" size={14} />
                </Button>
              </div>
            </>
          )}

          {/* 2단계: 게시물 선택 */}
          {boostSubStep === 2 && (
            <>
              <SubHead title="홍보할 게시물 선택" subtitle="인스타그램 계정의 최근 게시물 중 홍보할 콘텐츠를 골라주세요." />
              <BoostPostKnob selectedId={boostMedia?.id ?? null} onSelect={setBoostMedia} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                <Button variant="secondary" type="button" onClick={() => setBoostSubStep(1)}><Icon name="arrow-left" size={14} /> 이전</Button>
                <Button variant="primary" type="button" disabled={!boostMedia} onClick={() => setBoostSubStep(3)}>
                  다음 <Icon name="arrow-right" size={14} />
                </Button>
              </div>
            </>
          )}

          {/* 3단계: 예산 · 일정 */}
          {boostSubStep === 3 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <SubHead title="일일 예산" />
                  <div className="flex items-stretch border border-[var(--w-line-normal)] rounded-xl overflow-hidden bg-[var(--w-bg-elevated)] focus-within:border-[var(--w-primary-normal)] focus-within:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] transition-[border-color,box-shadow] duration-[120ms]">
                    <span className="grid place-items-center px-[14px] font-semibold text-[14px] leading-none text-[var(--w-fg-neutral)] bg-[var(--w-bg-alternative)] border-r border-[var(--w-line-normal)]">₩</span>
                    <input className="border-none flex-1 px-[14px] py-3 bg-transparent font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none" value={state.budget} onChange={(e) => dispatch({ type: "SET_BUDGET", value: fmtBudget(e.target.value) })} inputMode="numeric" placeholder="50,000" />
                  </div>
                  <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1.5 mb-0">최소 ₩10,000 / 일</p>
                </div>
                <div>
                  <SubHead title="집행 기간" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <p className="font-medium text-[12px] leading-none text-[var(--w-fg-neutral)] mb-1.5 mt-0">시작일</p>
                      <DatePicker value={state.dateStart} onChange={(v) => dispatch({ type: "SET_DATE_START", value: v })} />
                    </div>
                    <div>
                      <p className="font-medium text-[12px] leading-none text-[var(--w-fg-neutral)] mb-1.5 mt-0">종료일</p>
                      <DatePicker value={state.dateEnd} onChange={(v) => dispatch({ type: "SET_DATE_END", value: v })} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                <Button variant="secondary" type="button" onClick={() => setBoostSubStep(2)}><Icon name="arrow-left" size={14} /> 이전</Button>
                <Button variant="primary" type="button" disabled={budgetNum < 10000} onClick={() => setBoostSubStep(4)}>다음 <Icon name="arrow-right" size={14} /></Button>
              </div>
            </>
          )}

          {/* 4단계: 타겟 */}
          {boostSubStep === 4 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <SubHead title="연령" />
                  <AgeRange value={[state.ageMin, state.ageMax]} onChange={([min, max]) => dispatch({ type: "SET_AGE_RANGE", min, max })} />
                </div>
                <div>
                  <SubHead title="성별" />
                  <div className="flex gap-2 flex-wrap">
                    {GENDER_OPTS.map(([v, label]) => (
                      <button key={v} type="button" onClick={() => dispatch({ type: "SET_GENDER", value: v })} className={cn(chipBase, state.gender === v ? chipOn : "")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <SubHead title="국가" subtitle="최소 1개 선택 필수" />
                  <div className="flex gap-2 flex-wrap">
                    {COUNTRIES.slice(0, 8).map((c) => (
                      <button key={c.code} type="button" onClick={() => toggleCountry(c.code)} className={cn(chipBase, state.countries.includes(c.code) ? chipAccent : "")}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                <Button variant="secondary" type="button" onClick={() => setBoostSubStep(3)}><Icon name="arrow-left" size={14} /> 이전</Button>
                <Button variant="primary" type="button" disabled={state.countries.length === 0} onClick={() => setBoostSubStep(5)}>다음 <Icon name="arrow-right" size={14} /></Button>
              </div>
            </>
          )}

          {/* 5단계: 최종 확인 + 게재 */}
          {boostSubStep === 5 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {boostMedia?.mediaUrl && (
                    <img src={boostMedia.mediaUrl} alt="선택한 게시물" className="rounded-xl object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
                  )}
                  <div>
                    <p className="font-semibold text-[13.5px] leading-[1.4] text-[var(--w-fg-strong)] m-0 mb-1">선택한 게시물</p>
                    <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] m-0 line-clamp-2">{boostMedia?.caption || "캡션 없음"}</p>
                  </div>
                </div>
                <hr className="h-px bg-[var(--w-line-neutral)] border-0 m-0" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
                  <div><span style={{ color: "var(--w-fg-neutral)", display: "block", font: "500 11.5px/1 var(--w-font-sans)", marginBottom: 4 }}>홍보 방식</span>{boostGoalLabel}</div>
                  <div><span style={{ color: "var(--w-fg-neutral)", display: "block", font: "500 11.5px/1 var(--w-font-sans)", marginBottom: 4 }}>일일 예산</span>₩{budgetNum.toLocaleString("ko-KR")}</div>
                  <div><span style={{ color: "var(--w-fg-neutral)", display: "block", font: "500 11.5px/1 var(--w-font-sans)", marginBottom: 4 }}>기간</span>{state.dateStart} ~ {state.dateEnd}</div>
                  <div><span style={{ color: "var(--w-fg-neutral)", display: "block", font: "500 11.5px/1 var(--w-font-sans)", marginBottom: 4 }}>연령</span>{state.ageMin}~{state.ageMax}세 · {state.gender === "all" ? "전체" : state.gender === "male" ? "남성" : "여성"}</div>
                  <div><span style={{ color: "var(--w-fg-neutral)", display: "block", font: "500 11.5px/1 var(--w-font-sans)", marginBottom: 4 }}>국가</span>{state.countries.join(", ")}</div>
                  {boostGoal === 'website' && <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "var(--w-fg-neutral)", display: "block", font: "500 11.5px/1 var(--w-font-sans)", marginBottom: 4 }}>랜딩 URL</span>{boostLandingUrl}</div>}
                </div>
              </div>
              {boostMutation.isError && (
                <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border bg-[rgba(255,66,66,0.08)] border-[rgba(255,66,66,0.20)] text-[var(--w-status-negative)] mb-3" style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>
                  <Icon name="warn" size={16} />{boostMutation.error?.message}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Button variant="secondary" type="button" onClick={() => setBoostSubStep(4)}><Icon name="arrow-left" size={14} /> 이전</Button>
                <Button variant="primary" size="lg" type="button" disabled={!canBoostLaunch} onClick={runBoostLaunch}>
                  {boostMutation.isPending
                    ? <><div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite]" style={{ width: 16, height: 16 }} /> Meta에 전송 중…</>
                    : <><Icon name="instagram" size={16} /> 콘텐츠 홍보 시작하기</>}
                </Button>
              </div>
            </>
          )}
        </Card>
        <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <LaunchStatusPanel mutation={boostMutation} onNext={onNext} />
        </div>
        {modalOpen && <PreLaunchSafetyModal issues={safetyIssues} onClose={handleSafetyClose} onConfirm={handleSafetyConfirm} />}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "flex-start" }}>
      {/* Left: form */}
      <Card variant="lg">
        {/* 스텝 인디케이터 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          {subSteps.map((s, i) => {
            const done = s.n < subStep;
            const active = s.n === subStep;
            return (
              <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < subSteps.length - 1 ? 1 : undefined }}>
                <button
                  type="button"
                  onClick={() => setSubStep(s.n)}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: active || done ? "var(--w-accent-violet)" : "transparent",
                    border: `2px solid ${active || done ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
                    color: active || done ? "#fff" : "var(--w-fg-neutral)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    font: "700 11px/1 var(--w-font-sans)",
                  }}>
                    {done
                      ? <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : s.n}
                  </span>
                  <span style={{
                    font: `${active ? "600" : "500"} 13px/1 var(--w-font-sans)`,
                    color: active ? "var(--w-accent-violet)" : done ? "var(--w-fg-normal)" : "var(--w-fg-neutral)",
                    whiteSpace: "nowrap",
                  }}>
                    {s.label}
                  </span>
                </button>
                {i < subSteps.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? "var(--w-accent-violet)" : "var(--w-line-normal)", margin: "0 10px" }} />
                )}
              </div>
            );
          })}
        </div>
        <hr className="h-px bg-[var(--w-line-neutral)] border-0" style={{ margin: "0 0 20px" }} />

        {/* 1단계: 소재 확인 — destination + 목표별 고유 섹션 */}
        {subStep === 1 && (
          <>
            <ModeToggle />
            <CreativePreview />
            <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
            <DestinationField />
            {profile?.uniqueSections.includes("call_schedule") && (
              <>
                <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
                <CallScheduleSection />
              </>
            )}
            {profile?.uniqueSections.includes("messages_auto_reply") && (
              <>
                <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
                <MessagesAutoReplyCallout />
              </>
            )}
            {profile?.uniqueSections.includes("page_activity") && (
              <>
                <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
                <PageActivityCallout />
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <Button variant="primary" type="button" onClick={() => setSubStep(2)}>
                다음 <Icon name="arrow-right" size={14} />
              </Button>
            </div>
          </>
        )}

        {/* 2단계: 예산 · 일정 */}
        {subStep === 2 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <SubHead title="일일 예산" />
                <div className="flex items-stretch border border-[var(--w-line-normal)] rounded-xl overflow-hidden bg-[var(--w-bg-elevated)] focus-within:border-[var(--w-primary-normal)] focus-within:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] transition-[border-color,box-shadow] duration-[120ms]">
                  <span className="grid place-items-center px-[14px] font-semibold text-[14px] leading-none text-[var(--w-fg-neutral)] bg-[var(--w-bg-alternative)] border-r border-[var(--w-line-normal)]">₩</span>
                  <input
                    className="border-none flex-1 px-[14px] py-3 bg-transparent font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none"
                    value={state.budget}
                    onChange={(e) => dispatch({ type: "SET_BUDGET", value: fmtBudget(e.target.value) })}
                    inputMode="numeric"
                    placeholder="50,000"
                    aria-label="일일 예산"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {["30,000", "50,000", "100,000", "200,000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={cn(chipBase, state.budget === preset && chipOn)}
                      onClick={() => dispatch({ type: "SET_BUDGET", value: preset })}
                    >
                      ₩{preset}
                    </button>
                  ))}
                </div>
                <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]" style={{ marginTop: 8 }}>최소 ₩10,000부터 설정할 수 있어요.</div>
              </div>
              <div>
                <SubHead title="집행 기간" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
                  <DatePicker
                    value={state.dateStart}
                    onChange={(v) => dispatch({ type: "SET_DATE_START", value: v })}
                    placeholder="시작일"
                    aria-label="시작일"
                  />
                  <span style={{ color: "var(--w-fg-neutral)", textAlign: "center" }}>—</span>
                  <DatePicker
                    value={state.dateEnd}
                    onChange={(v) => dispatch({ type: "SET_DATE_END", value: v })}
                    placeholder="종료일"
                    aria-label="종료일"
                  />
                </div>
              </div>
              {(budgetNum > 0 || days > 0) && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", borderRadius: 10,
                  background: "var(--w-primary-soft)",
                  color: "var(--w-primary-press)",
                  font: "500 13px/1.4 var(--w-font-sans)",
                }}>
                  <Icon name="sparkles" size={14} />
                  <span>
                    {days > 0 ? `${days}일간 ` : ""}예상 노출&nbsp;
                    <strong>{fmt(impMin)} – {fmt(impMax)}회</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3" style={{ marginTop: 24 }}>
              <Button variant="secondary" type="button" onClick={() => setSubStep(1)}>
                <Icon name="arrow-left" size={14} /> 이전
              </Button>
              <Button variant="primary" type="button" onClick={() => setSubStep(3)}>
                다음 <Icon name="arrow-right" size={14} />
              </Button>
            </div>
          </>
        )}

        {/* 3단계: 타겟 */}
        {subStep === 3 && (
          <>
            <SubHead
              title="타겟"
              subtitle={state.mode === "simple" ? "광고를 노출할 국가만 선택하세요. 연령·성별은 Meta 어드밴티지+가 자동으로 최적화해요." : "AI가 채워둔 값이에요. 그대로 두거나 조정해도 돼요."}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {state.mode === "simple" && (
                <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5" style={{ color: "var(--w-primary-press)" }}>
                  <Icon name="sparkles" size={12} />
                  어드밴티지+ 타겟 · 노출 위치 — 연령·성별·게재 위치를 Meta가 자동으로 최적화해요.
                </div>
              )}
              {state.mode === "detailed" && (
                <>
                  <div>
                    <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5" style={{ marginBottom: 10 }}>연령</label>
                    {targeting && (
                      <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]" style={{ color: "var(--w-primary-press)", marginBottom: 8 }}>
                        ✦ &lsquo;누구에게 보여줄 광고인가요&rsquo; 입력 내용에서 자동으로 채웠어요 · 수정 가능
                      </div>
                    )}
                    <AgeRange
                      value={[state.ageMin, state.ageMax]}
                      onChange={(v) => dispatch({ type: "SET_AGE_RANGE", min: v[0], max: v[1] })}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5" style={{ marginBottom: 8 }}>성별</label>
                    <div className="flex gap-2 flex-wrap">
                      {GENDER_OPTS.map(([k, l]) => (
                        <button
                          key={k}
                          type="button"
                          className={cn(chipBase, state.gender === k && chipOn)}
                          onClick={() => dispatch({ type: "SET_GENDER", value: k })}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5" style={{ marginBottom: 8 }}>지역 (국가, 복수 선택)</label>
                <div className="flex gap-2 flex-wrap">
                  {COUNTRIES.map((c) => {
                    const on = state.countries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        className={cn(chipBase, on && chipAccent)}
                        onClick={() => toggleCountry(c.code)}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {state.countries.length === 0 && (
                  <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)]" style={{ marginTop: 8 }}>최소 1개 국가를 선택해주세요.</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3" style={{ marginTop: 24 }}>
              <Button variant="secondary" type="button" onClick={() => setSubStep(2)}>
                <Icon name="arrow-left" size={14} /> 이전
              </Button>
              <Button variant="primary" type="button" onClick={() => setSubStep(4)}>
                다음 <Icon name="arrow-right" size={14} />
              </Button>
            </div>
          </>
        )}

        {/* 4단계: 고급 설정 (detailed only) */}
        {subStep === 4 && state.mode === "detailed" && (
          <>
            <ObjectivePicker goCreative={goCreative} />
            <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
            <DetailKnobs />
            <div className="flex items-center justify-between gap-3" style={{ marginTop: 24 }}>
              <Button variant="secondary" type="button" onClick={() => setSubStep(3)}>
                <Icon name="arrow-left" size={14} /> 이전
              </Button>
              <Button variant="primary" type="button" onClick={() => setSubStep(5)}>
                다음 <Icon name="arrow-right" size={14} />
              </Button>
            </div>
          </>
        )}

        {/* 최종 확인: simple=4단계, detailed=5단계 */}
        {((subStep === 4 && state.mode !== "detailed") || subStep === 5) && (
          <>
            <SubHead title="게재 상태" />
            <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]" style={{ marginTop: 4 }}>
              <button
                type="button"
                className={cn(
                  "border-none bg-transparent px-[14px] py-2 rounded-[8px] font-semibold text-[12.5px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
                  state.delivery === "PAUSED"
                    ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                    : "text-[var(--w-fg-neutral)]"
                )}
                onClick={() => dispatch({ type: "SET_DELIVERY", value: "PAUSED" })}
              >
                일시중지로 생성
              </button>
              <button
                type="button"
                className={cn(
                  "border-none bg-transparent px-[14px] py-2 rounded-[8px] font-semibold text-[12.5px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
                  state.delivery === "ACTIVE"
                    ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                    : "text-[var(--w-fg-neutral)]"
                )}
                onClick={() => dispatch({ type: "SET_DELIVERY", value: "ACTIVE" })}
              >
                지금 바로 게재
              </button>
            </div>
            {state.delivery === "ACTIVE" && (
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)] flex gap-1.5 items-center" style={{ marginTop: 10 }}>
                <Icon name="warn" size={14} />
                게재 즉시 Meta 정책 검토에 들어가요. 검토 통과 후 자동으로 노출과 광고비가 시작돼요.
              </div>
            )}

            <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
            {!hasCreative && (
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)] flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
                <Icon name="warn" size={14} /> 아직 광고 소재가 없어요. STEP 01에서 소재를 만들면 집행할 수 있어요.
              </div>
            )}
            {!accountConnected && browseMode && (
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
                <Icon name="info" size={13} /> 둘러보기 모드 — 실제 게재 대신 모의 흐름이 진행돼요. 실제 집행은 계정 연결 후 가능해요.
                <Button variant="ghost" size="sm" type="button" onClick={goSettings}>
                  계정 연결하러 가기 →
                </Button>
              </div>
            )}
            {!accountConnected && !browseMode && (
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)] flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
                <Icon name="warn" size={14} /> 광고 계정·페이지가 연결되지 않아 집행할 수 없어요.
                <Button variant="ghost" size="sm" type="button" onClick={goSettings}>
                  계정 연결하러 가기 →
                </Button>
              </div>
            )}
            {session?.pixelId ? (
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5" style={{ marginBottom: 12, color: "var(--w-primary-press)" }}>
                <Icon name="check" size={13} strokeWidth={3} /> Pixel 추적 중 — {session.pixelName ?? session.pixelId}
              </div>
            ) : (
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
                <Icon name="info" size={13} />
                Pixel이 연결되지 않았어요. 연결하면 광고 클릭 후 사이트 방문을 추적할 수 있어요.
                <Button variant="ghost" size="sm" type="button" onClick={() => router.push("/connect")}>Pixel 연결하러 가기 →</Button>
              </div>
            )}
            {launchMutation.isError && (
              <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border bg-[rgba(255,66,66,0.08)] border-[rgba(255,66,66,0.20)] text-[var(--w-status-negative)]" style={{ marginBottom: 12 }}>
                <Icon name="warn" size={16} />
                <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>{launchMutation.error?.message}</div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3" style={{ marginTop: 8 }}>
              <Button variant="secondary" type="button" onClick={() => setSubStep(state.mode === "detailed" ? 4 : 3)}>
                <Icon name="arrow-left" size={14} /> 이전
              </Button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="info" size={13} /> Meta 광고 정책 검토는 자동 진행돼요
                </span>
                <Button variant="primary" size="lg" type="button" disabled={!canLaunch} onClick={handleLaunch}>
                  {launchMutation.isPending ? (
                    <><div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite]" style={{ width: 16, height: 16 }} /> Meta에 전송 중…</>
                  ) : (
                    <><Icon name="megaphone" size={16} /> {browseMode
                      ? (state.delivery === "ACTIVE" ? "Meta에 광고 게재하기 (둘러보기 모드)" : "Meta에 광고 등록하기 (둘러보기 모드)")
                      : (state.delivery === "ACTIVE" ? "Meta에 광고 게재하기" : "Meta에 광고 등록하기 (일시중지)")}</>
                  )}
                </Button>
              </div>
            </div>

            {devModeOn && testAccountActive && (
              <Card
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderStyle: "dashed",
                  background: "var(--w-bg-alternative)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name="info" size={14} />
                  <span style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                    Meta 테스트 광고 계정 활성화
                  </span>
                </div>
                <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: 0 }}>
                  위 게재 버튼이 <strong>{testAccountId}</strong> 로 Campaign → AdSet → AdCreative → Ad 까지 전체 호출돼요.
                  실제 노출·과금은 없어요. 인사이트는 0 으로 반환돼요.
                </p>
              </Card>
            )}

            {devModeOn && !testAccountActive && (
              <Card
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderStyle: "dashed",
                  background: "var(--w-bg-alternative)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name="info" size={14} />
                  <span style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                    Meta App 개발 모드 전용
                  </span>
                </div>
                <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "0 0 12px" }}>
                  개발 모드 앱에선 광고 크리에이티브 생성이 막혀요 (subcode 1885183).
                  Ad Creative · Ad 단계를 건너뛰고 <strong>캠페인 + 광고 세트까지만</strong> 만들어요. PAUSED 상태로 고정돼요.
                  <br />
                  <span style={{ color: "var(--w-fg-neutral)" }}>
                    💡 전체 플로우 검증은 <code>NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID</code> 셋팅으로 가능해요.
                  </span>
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={!canSkipLaunch}
                  onClick={handleSkipAdLaunch}
                >
                  {launchMutation.isPending ? (
                    <><div className="rounded-full border-[2px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite]" style={{ width: 12, height: 12 }} /> 전송 중…</>
                  ) : (
                    <>캠페인 + 세트만 생성 (광고 없이)</>
                  )}
                </Button>
              </Card>
            )}
          </>
        )}
      </Card>

      {/* Right: status + summary */}
      <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <LaunchStatusPanel mutation={launchMutation} onNext={onNext} />
        <SummaryCard />
      </div>

      {modalOpen && (
        <PreLaunchSafetyModal
          issues={safetyIssues}
          onClose={handleSafetyClose}
          onConfirm={handleSafetyConfirm}
        />
      )}
    </div>
  );
}
