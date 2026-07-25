"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLaunchDraft, type LaunchedCampaign } from "@entities/campaign/model";
import { saveLaunchedCampaign } from "@entities/campaign/launched-storage";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useToast } from "@shared/ui/Toast";
import { type LaunchResponse } from "@entities/campaign/model";
import { COUNTRIES } from "@shared/lib/geo-options";
import { type Gender } from "@shared/lib/meta/targeting";
import AgeRange from "@shared/ui/AgeRange";
import SubHead from "./SubHead";
import SubStepIndicator from "./SubStepIndicator";
import BoostPostKnob, { type IgMediaItem } from "./BoostPostKnob";
import LaunchStatusPanel from "./LaunchStatusPanel";
import DatePicker from "@shared/ui/DatePicker";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { fmtBudget } from "@shared/lib/launch-utils";

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";
const chipAccent = "border-[var(--w-primary-normal)] text-[var(--w-primary-press)] bg-[var(--w-primary-soft)]";
const GENDER_OPTS: [Gender, string][] = [["all", "전체"], ["male", "남성"], ["female", "여성"]];

const BOOST_STEPS = [
  { n: 1 as const, label: "홍보 방식" },
  { n: 2 as const, label: "게시물 선택" },
  { n: 3 as const, label: "예산 · 일정" },
  { n: 4 as const, label: "타겟" },
  { n: 5 as const, label: "최종 확인" },
];

interface Props { onNext: () => void }

export default function BoostPostFlow({ onNext }: Props) {
  const { state, dispatch } = useLaunchDraft();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const boostMutation = useApiMutation<object, LaunchResponse>("/api/boost-post");
  const showToast = useToast();

  const [boostGoal, setBoostGoal] = useState<'engagement' | 'profile' | 'website' | 'message'>('engagement');
  const [boostLandingUrl, setBoostLandingUrl] = useState('');
  const [preselectId] = useState<string | null>(() => {
    try {
      const id = sessionStorage.getItem("adflow_boost_igmedia_preselect");
      sessionStorage.removeItem("adflow_boost_igmedia_preselect");
      return id;
    } catch { return null; }
  });
  const [boostMedia, setBoostMedia] = useState<IgMediaItem | null>(null);
  const [boostSubStep, setBoostSubStep] = useState<1 | 2 | 3 | 4 | 5>(preselectId ? 2 : 1);

  const budgetNum = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
  const canBoostLaunch = !boostMutation.isPending && !state.launchedCampaign && !!boostMedia
    && budgetNum >= 10000 && state.countries.length > 0
    && (boostGoal !== 'website' || boostLandingUrl.trim().startsWith('https://'));

  const boostGoalLabel = { engagement: '더 많은 참여 유도', profile: '프로필 방문 늘리기', website: '웹사이트 방문 유도', message: '메시지 받기' }[boostGoal];

  const toggleCountry = (code: string) => {
    const next = state.countries.includes(code)
      ? state.countries.filter((c) => c !== code)
      : [...state.countries, code];
    dispatch({ type: "SET_COUNTRIES", value: next });
  };

  const runBoostLaunch = () => {
    if (!boostMedia) { showToast("홍보할 게시물을 선택해주세요."); return; }
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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "flex-start" }}>
      <Card variant="lg">
        <SubStepIndicator steps={BOOST_STEPS} current={boostSubStep} onStepClick={(n) => setBoostSubStep(n as 1 | 2 | 3 | 4 | 5)} />
        <hr className="h-px bg-[var(--w-line-neutral)] border-0" style={{ margin: "0 0 20px" }} />

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

        {boostSubStep === 2 && (
          <>
            <SubHead title="홍보할 게시물 선택" subtitle="인스타그램 계정의 최근 게시물 중 홍보할 콘텐츠를 골라주세요." />
            <BoostPostKnob selectedId={boostMedia?.id ?? null} onSelect={setBoostMedia} preselectId={preselectId} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <Button variant="secondary" type="button" onClick={() => setBoostSubStep(1)}><Icon name="arrow-left" size={14} /> 이전</Button>
              <Button variant="primary" type="button" disabled={!boostMedia} onClick={() => setBoostSubStep(3)}>
                다음 <Icon name="arrow-right" size={14} />
              </Button>
            </div>
          </>
        )}

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

        {boostSubStep === 5 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {boostMedia?.mediaUrl && (
                  <img src={boostMedia.mediaUrl} alt="선택한 게시물" className="rounded-xl object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
                )}
                <div>
                  <p className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)] m-0 mb-1">선택한 게시물</p>
                  <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] m-0 line-clamp-2">{boostMedia?.caption || "캡션 없음"}</p>
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
    </div>
  );
}
