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
import { useLaunchDraft, type LaunchParams, type LaunchResponse } from "@entities/campaign/model";
import { saveLaunchedCampaign } from "@entities/campaign/launched-storage";
import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from "@entities/creative/options";
import { LAUNCH_PROFILES } from "@entities/launch-objective/profile";
import { type Gender } from "@shared/lib/meta/targeting";
import { calcDaysBetween, estimateImpressionRange } from "@entities/insights/budget-estimates";
import { addNotification } from "@shared/lib/notifications";
import { useToast } from "@shared/ui/Toast";
import { validateAdImage, buildLaunchParams, buildLaunchedCampaign, launchSuccessMessage } from "@features/launch-campaign/build";

import DatePicker from "@shared/ui/DatePicker";
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

const SUB_STEPS = [
  { n: 1 as const, label: "소재 확인" },
  { n: 2 as const, label: "예산 · 타겟" },
  { n: 3 as const, label: "최종 확인" },
];

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
  const launchMutation = useApiMutation<LaunchParams, LaunchResponse>("/api/campaign");
  const showToast = useToast();

  // PRD §13.10 — single-select. outcome 의 goal entry. STEP 02 link prefill + 전화 받기 page phone 검증 source.
  const outcomeChip = creative.state.outcome;
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
    launchMutation.mutate(params, {
      onSuccess: (data) => {
        const launched = buildLaunchedCampaign(data, params);
        dispatch({ type: "SET_LAUNCHED_CAMPAIGN", value: launched });
        saveLaunchedCampaign(launched);
        addNotification({ type: "launch", message: launchSuccessMessage(params) });
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
  const baseLaunchOk = accountConnected && hasCreative && state.countries.length > 0 && !launchMutation.isPending && !state.launchedCampaign;
  // PRD-objective-aware-launch §3·§5.1 — URL https 만 inline 게이트. 나머지(phone·시간대·메신저·페이지 활성도)는 PreLaunchSafetyModal 에서.
  // hidden 인 목표(awareness, leads_call) 는 URL 형식 검증 불필요. user_input/prefilled_locked 는 https 필수.
  const urlRequired = profile?.url.mode !== "hidden";
  const canLaunch = baseLaunchOk && (skipAd || !urlRequired || httpsOk);
  const canSkipLaunch = baseLaunchOk;

  const [subStep, setSubStep] = useState<1 | 2 | 3>(1);

  const toggleCountry = (code: string) => {
    const next = state.countries.includes(code)
      ? state.countries.filter((c) => c !== code)
      : [...state.countries, code];
    dispatch({ type: "SET_COUNTRIES", value: next });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "flex-start" }}>
      {/* Left: form */}
      <div className="card card--lg">
        {/* 스텝 인디케이터 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          {SUB_STEPS.map((s, i) => {
            const done = s.n < subStep;
            const active = s.n === subStep;
            return (
              <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < SUB_STEPS.length - 1 ? 1 : undefined }}>
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
                {i < SUB_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? "var(--w-accent-violet)" : "var(--w-line-normal)", margin: "0 10px" }} />
                )}
              </div>
            );
          })}
        </div>
        <hr className="divider" style={{ margin: "0 0 20px" }} />

        {/* 1단계: 소재 확인 — destination + 목표별 고유 섹션 */}
        {subStep === 1 && (
          <>
            <ModeToggle />
            <CreativePreview />
            <hr className="divider" />
            <DestinationField />
            {profile?.uniqueSections.includes("call_schedule") && (
              <>
                <hr className="divider" />
                <CallScheduleSection />
              </>
            )}
            {profile?.uniqueSections.includes("messages_auto_reply") && (
              <>
                <hr className="divider" />
                <MessagesAutoReplyCallout />
              </>
            )}
            {profile?.uniqueSections.includes("page_activity") && (
              <>
                <hr className="divider" />
                <PageActivityCallout />
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn btn--primary" type="button" onClick={() => setSubStep(2)}>
                다음 <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </>
        )}

        {/* 2단계: 예산 · 타겟 */}
        {subStep === 2 && (
          <>
            {state.mode === "detailed" && (
              <>
                <ObjectivePicker goCreative={goCreative} />
                <DetailKnobs />
                <hr className="divider" />
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <SubHead title="일일 예산" />
                <div className="input--addon">
                  <span className="addon">₩</span>
                  <input
                    value={state.budget}
                    onChange={(e) => dispatch({ type: "SET_BUDGET", value: fmtBudget(e.target.value) })}
                    inputMode="numeric"
                    placeholder="50,000"
                    aria-label="일일 예산"
                  />
                </div>
                <div className="field__hint" style={{ marginTop: 8 }}>최소 ₩10,000부터 설정할 수 있어요.</div>
              </div>
              <div>
                <SubHead title="집행 기간" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                  <DatePicker
                    value={state.dateStart}
                    onChange={(v) => dispatch({ type: "SET_DATE_START", value: v })}
                    placeholder="시작일"
                    aria-label="시작일"
                  />
                  <span style={{ color: "var(--w-fg-neutral)" }}>—</span>
                  <DatePicker
                    value={state.dateEnd}
                    onChange={(v) => dispatch({ type: "SET_DATE_END", value: v })}
                    placeholder="종료일"
                    aria-label="종료일"
                  />
                </div>
                <div className="field__hint" style={{ marginTop: 8 }}>총 {days}일 · 예상 노출 {fmt(impMin)}–{fmt(impMax)}</div>
              </div>
            </div>

            <hr className="divider" />
            <SubHead
              title="타겟"
              subtitle={state.mode === "simple" ? "광고를 노출할 국가만 선택하세요. 연령·성별은 Meta 어드밴티지+가 자동으로 최적화해요." : "AI가 채워둔 값이에요. 그대로 두거나 조정해도 돼요."}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {state.mode === "simple" && (
                <div className="field__hint" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--w-primary-press)" }}>
                  <Icon name="sparkles" size={12} />
                  어드밴티지+ 타겟 · 노출 위치 — 연령·성별·게재 위치를 Meta가 자동으로 최적화해요.
                </div>
              )}
              {state.mode === "detailed" && (
                <>
                  <div>
                    <label className="field__label" style={{ marginBottom: 10 }}>연령</label>
                    {targeting && (
                      <div className="field__hint" style={{ color: "var(--w-primary-press)", marginBottom: 8 }}>
                        ✦ &lsquo;누구에게 보여줄 광고인가요&rsquo; 입력 내용에서 자동으로 채웠어요 · 수정 가능
                      </div>
                    )}
                    <AgeRange
                      value={[state.ageMin, state.ageMax]}
                      onChange={(v) => dispatch({ type: "SET_AGE_RANGE", min: v[0], max: v[1] })}
                    />
                  </div>
                  <div>
                    <label className="field__label" style={{ marginBottom: 8 }}>성별</label>
                    <div className="chips">
                      {GENDER_OPTS.map(([k, l]) => (
                        <button
                          key={k}
                          type="button"
                          className={"chip" + (state.gender === k ? " chip--on" : "")}
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
                <label className="field__label" style={{ marginBottom: 8 }}>지역 (국가, 복수 선택)</label>
                <div className="chips">
                  {COUNTRIES.map((c) => {
                    const on = state.countries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        className={"chip" + (on ? " chip--accent" : "")}
                        onClick={() => toggleCountry(c.code)}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {state.countries.length === 0 && (
                  <div className="field__hint field__hint--warn" style={{ marginTop: 8 }}>최소 1개 국가를 선택해주세요.</div>
                )}
              </div>
            </div>

            <div className="between" style={{ marginTop: 24 }}>
              <button className="btn btn--secondary" type="button" onClick={() => setSubStep(1)}>
                <Icon name="arrow-left" size={14} /> 이전
              </button>
              <button className="btn btn--primary" type="button" onClick={() => setSubStep(3)}>
                다음 <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </>
        )}

        {/* 3단계: 최종 확인 */}
        {subStep === 3 && (
          <>
            <SubHead title="게재 상태" />
            <div className="seg" style={{ marginTop: 4 }}>
              <button
                type="button"
                className={state.delivery === "PAUSED" ? "on" : ""}
                onClick={() => dispatch({ type: "SET_DELIVERY", value: "PAUSED" })}
              >
                일시중지로 생성
              </button>
              <button
                type="button"
                className={state.delivery === "ACTIVE" ? "on" : ""}
                onClick={() => dispatch({ type: "SET_DELIVERY", value: "ACTIVE" })}
              >
                지금 바로 게재
              </button>
            </div>
            {state.delivery === "ACTIVE" && (
              <div className="field__hint field__hint--warn" style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
                <Icon name="warn" size={14} />
                게재 즉시 Meta 정책 검토에 들어가요. 검토 통과 후 자동으로 노출과 광고비가 시작돼요.
              </div>
            )}

            <hr className="divider" />
            {!hasCreative && (
              <div className="field__hint field__hint--warn" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Icon name="warn" size={14} /> 아직 광고 소재가 없어요. STEP 01에서 소재를 만들면 집행할 수 있어요.
              </div>
            )}
            {!accountConnected && (
              <div className="field__hint field__hint--warn" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Icon name="warn" size={14} /> 광고 계정·페이지가 연결되지 않아 집행할 수 없어요.
                <button className="btn btn--ghost btn--sm" type="button" onClick={goSettings}>
                  계정 연결하러 가기 →
                </button>
              </div>
            )}
            {session?.pixelId ? (
              <div className="field__hint" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--w-primary-press)" }}>
                <Icon name="check" size={13} strokeWidth={3} /> Pixel 추적 중 — {session.pixelName ?? session.pixelId}
              </div>
            ) : (
              <div className="field__hint" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Icon name="info" size={13} />
                Pixel이 연결되지 않았어요. 연결하면 광고 클릭 후 사이트 방문을 추적할 수 있어요.
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => router.push("/connect")}>Pixel 연결하러 가기 →</button>
              </div>
            )}
            {launchMutation.isError && (
              <div className="callout callout--danger" style={{ marginBottom: 12 }}>
                <Icon name="warn" size={16} />
                <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>{launchMutation.error?.message}</div>
              </div>
            )}
            <div className="between" style={{ marginTop: 8 }}>
              <button className="btn btn--secondary" type="button" onClick={() => setSubStep(2)}>
                <Icon name="arrow-left" size={14} /> 이전
              </button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="info" size={13} /> Meta 광고 정책 검토는 자동 진행돼요
                </span>
                <button className="btn btn--primary btn--lg" type="button" disabled={!canLaunch} onClick={handleLaunch}>
                  {launchMutation.isPending ? (
                    <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2.4 }} /> Meta에 전송 중…</>
                  ) : (
                    <><Icon name="megaphone" size={16} /> {state.delivery === "ACTIVE" ? "Meta에 광고 게재하기" : "Meta에 광고 등록하기 (일시중지)"}</>
                  )}
                </button>
              </div>
            </div>

            {devModeOn && testAccountActive && (
              <div
                className="card"
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
              </div>
            )}

            {devModeOn && !testAccountActive && (
              <div
                className="card"
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
                <button
                  className="btn btn--secondary btn--sm"
                  type="button"
                  disabled={!canSkipLaunch}
                  onClick={handleSkipAdLaunch}
                >
                  {launchMutation.isPending ? (
                    <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> 전송 중…</>
                  ) : (
                    <>캠페인 + 세트만 생성 (광고 없이)</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

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
