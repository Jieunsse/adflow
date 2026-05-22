"use client";

// STEP 02 sub-step 1 — 광고 클릭 destination + CTA 분기. PRD-objective-aware-launch §3.
//   profile.url.mode === 'hidden'            → 표시 X (awareness, leads_call. leads_call 의 phone callout 은 CallScheduleSection 에서)
//   profile.url.mode === 'user_input'        → https URL 입력 (traffic, engagement)
//   profile.url.mode === 'prefilled_locked'  → 페이지/메신저 카드 + override 펼침 (traffic_page_visit, page_likes, messages)
//
//   profile.cta.mode === 'user_choice'       → CTA chip picker 노출 (traffic, engagement)
//   profile.cta.mode === 'locked'            → CTA 노출 X (defaultCta 가 그대로 적용)

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import { OBJECTIVES_PHASE1, CTAS, type CtaId, type ObjectivePhase1Id } from "@entities/creative/options";
import { LAUNCH_PROFILES } from "@entities/launch-objective/profile";
import SubHead from "./SubHead";

type Page = { id: string; name: string; phone: string | null };

const USER_CHOICE_CTAS: CtaId[] = ["buy", "learn", "sample"];

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";

export default function DestinationField() {
  const { state, dispatch } = useLaunchDraft();
  const { state: creative, dispatch: creativeDispatch } = useCreativeDraft();
  const { data: session } = useSession();

  const outcomeId = creative.outcome;
  const goalDef = outcomeId ? OBJECTIVES_PHASE1.find((g) => g.id === outcomeId) : null;
  const profile = outcomeId && outcomeId in LAUNCH_PROFILES
    ? LAUNCH_PROFILES[outcomeId as ObjectivePhase1Id]
    : null;
  const urlMode = profile?.url.mode ?? "user_input";
  const ctaMode = profile?.cta.mode ?? "locked";

  const { data: pagesData } = useQuery({
    queryKey: ["setup-pages"],
    queryFn: async (): Promise<{ pages: Page[] }> => {
      const res = await fetch("/api/setup/pages");
      if (!res.ok) throw new Error("페이지 조회 실패");
      return res.json();
    },
    enabled: !!session?.pageId && urlMode === "prefilled_locked",
  });
  const activePage = pagesData?.pages.find((p) => p.id === session?.pageId);

  const httpsOk = state.landingUrl.trim().startsWith("https://");
  const [overrideOpen, setOverrideOpen] = useState(false);

  const ctaPicker = ctaMode === "user_choice" ? (
    <>
      <SubHead title="버튼 문구" subtitle="광고 클릭 버튼에 표시될 문구예요. 목표에 맞는 문구를 골라주세요." />
      <div className="flex flex-wrap gap-2 mb-3">
        {USER_CHOICE_CTAS.map((id) => {
          const label = CTAS.find((c) => c.id === id)?.label ?? id;
          const on = creative.cta === id;
          return (
            <button
              key={id}
              type="button"
              className={cn(chipBase, on && chipOn)}
              onClick={() => creativeDispatch({ type: "SET_CTA", cta: id })}
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  ) : null;

  if (urlMode === "hidden") {
    if (!goalDef) return null;
    return ctaPicker;
  }

  if (urlMode === "user_input") {
    return (
      <>
        <SubHead title="광고 클릭 시 보여줄 페이지" subtitle="광고를 누른 사용자가 이동할 URL 이에요." />
        <input
          className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
          value={state.landingUrl}
          onChange={(e) => dispatch({ type: "SET_LANDING_URL", value: e.target.value })}
          placeholder="https://example.com/landing"
          type="url"
          inputMode="url"
        />
        {!httpsOk && (
          <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-negative)] mt-2">
            https:// 로 시작해야 해요.
          </div>
        )}
        {ctaPicker && <div className="mt-4">{ctaPicker}</div>}
      </>
    );
  }

  const isMessenger = goalDef?.defaultLink === "messenger";
  const destLabel = isMessenger ? "Messenger 대화창" : "Facebook 페이지";
  const destIcon = isMessenger ? "message" : "facebook";
  const destSubtitle = isMessenger
    ? "광고를 누르면 활성 페이지의 Messenger 대화창이 바로 열려요."
    : "광고를 누르면 활성 Facebook 페이지로 이동해요.";

  const fallbackUrl = isMessenger
    ? `m.me/${session?.pageId ?? "…"}`
    : `facebook.com/${session?.pageId ?? "…"}`;

  return (
    <>
      <SubHead title="사람들이 어디로 가나요?" subtitle={destSubtitle} />
      <Card className="p-4 flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-full bg-[var(--w-primary-soft)] text-[var(--w-accent-violet)] grid place-items-center shrink-0">
          <Icon name={destIcon} size={20} strokeWidth={1.7} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[11.5px] leading-none text-[var(--w-fg-neutral)] mb-1">
            {destLabel}
          </div>
          <div className="font-bold text-[14.5px] leading-[1.3] text-[var(--w-fg-strong)]">
            {activePage?.name ?? "활성 페이지 확인 중…"}
          </div>
          <div className="font-medium text-[11px] leading-[1.2] font-[var(--w-font-mono)] text-[var(--w-fg-alternative)] mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {state.landingUrl || fallbackUrl}
          </div>
        </div>
      </Card>

      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="mt-2.5"
        onClick={() => setOverrideOpen((v) => !v)}
      >
        <Icon name="arrow-right" size={12} /> {overrideOpen ? "직접 입력 닫기" : "다른 URL 로 보내고 싶어요"}
      </Button>

      {overrideOpen && (
        <div className="mt-2.5">
          <input
            className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
            value={state.landingUrl}
            onChange={(e) => dispatch({ type: "SET_LANDING_URL", value: e.target.value })}
            placeholder="https://example.com/landing"
            type="url"
            inputMode="url"
          />
          {!httpsOk && (
            <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-negative)] mt-2">
              https:// 로 시작해야 해요.
            </div>
          )}
          <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] mt-1.5">
            기본은 활성 {destLabel} 로 자동 연결돼요. 다른 URL 로 바꾸면 광고 목표와 어긋날 수 있어요.
          </div>
        </div>
      )}
    </>
  );
}
