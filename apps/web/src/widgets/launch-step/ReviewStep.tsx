"use client";

import { useSession } from "next-auth/react";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";
import { findObjective, CTA_LABEL } from "@entities/creative/options";
import { profileOf } from "@entities/launch-objective/profile";
import { fmt } from "@shared/lib/format";
import { COUNTRIES } from "@shared/lib/geo-options";
import { calcDaysBetween } from "@entities/insights/budget-estimates";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { AdMockFull } from "@widgets/create-flow/AdMockup";
import { PanelCard } from "@widgets/create-flow/parts";
import { useBrandHandle } from "@widgets/create-flow/useBrandHandle";

type Props = {
  blockReason: string | null;
  launching: boolean;
  onBack: () => void;
  onEditBrief: () => void;
  onEditCreative: () => void;
  onLaunch: () => void;
};

function ReviewRow({
  label,
  value,
  ready,
  onEdit,
}: {
  label: string;
  value: string;
  ready: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--w-line-alternative)] px-4 py-3 last:border-b-0">
      <Icon name={ready ? "check" : "warn"} size={16} className={ready ? "text-[var(--w-status-positive)]" : "text-[var(--w-status-cautionary)]"} />
      <span className="w-[88px] shrink-0 text-[13px] font-semibold leading-[1.4] text-[var(--w-fg-normal)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[1.4] text-[var(--w-fg-strong)]">{value}</span>
      <button type="button" onClick={onEdit} className="shrink-0 text-[12px] font-semibold text-[var(--w-primary-normal)]">
        수정하기
      </button>
    </div>
  );
}

export default function ReviewStep(p: Props) {
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const { data: session } = useSession();
  const handle = useBrandHandle();
  const state = launch.state;
  const goal = creative.state.outcome ? findObjective(creative.state.outcome) : null;
  const profile = profileOf(creative.state.outcome);
  const imageUrl = state.finalImageDataUrl ?? state.imageDataUrl;
  const budget = parseInt(state.budget.replace(/[^\d]/g, ""), 10) || 0;
  const days = calcDaysBetween(state.dateStart, state.dateEnd);
  const urlRequired = profile?.url.mode !== "hidden";
  const urlReady = !urlRequired || state.landingUrl.trim().startsWith("https://");
  const targetReady = state.countries.length > 0;
  const accountReady = !!session?.browseMode || !!(session?.adAccountId && session?.pageId);
  const creativeReady = creative.state.headline.trim().length > 0;
  const countryLabel = state.countries.map((code) => COUNTRIES.find((country) => country.code === code)?.label ?? code).join(" · ");
  const targetLabel = `${state.gender === "female" ? "여성" : state.gender === "male" ? "남성" : "전체"} · ${state.ageMin}–${state.ageMax}세 · ${countryLabel || "미선택"}`;

  return (
    <div className="overflow-hidden rounded-[var(--w-radius-16)] bg-[var(--w-bg-alternative)]">
      <div className="border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-normal)] px-6 py-4">
        <p className="w-overline m-0 text-[var(--w-primary-normal)]">광고 만들기 · 최종 확인</p>
        <h1 className="w-h2 m-0 mt-1">이 내용으로 게재할까요?</h1>
        <p className="w-caption m-0 mt-1">수정할 항목이 있으면 지금 돌아가 바꿀 수 있어요.</p>
      </div>

      <div className="flex items-start gap-5 px-6 py-5">
        <PanelCard className="w-[392px] shrink-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--w-line-alternative)] px-3.5 py-3">
            <span className="text-[13px] font-semibold leading-[1.4] text-[var(--w-fg-strong)]">확정한 광고</span>
            <button type="button" onClick={p.onEditCreative} className="text-[12px] font-semibold text-[var(--w-primary-normal)]">소재 수정</button>
          </div>
          <AdMockFull
            handle={handle}
            imageUrl={imageUrl}
            imageTag={imageUrl ? null : "이미지 없음"}
            imageHeight={300}
            headline={creative.state.headline}
            body={creative.state.primaryText}
            ctaLabel={CTA_LABEL[creative.state.cta]}
          />
        </PanelCard>

        <div className="min-w-0 flex-1">
          <PanelCard className="overflow-hidden">
            <div className="border-b border-[var(--w-line-alternative)] px-4 py-4">
              <h2 className="m-0 text-[16px] font-bold leading-[1.4] text-[var(--w-fg-strong)]">게재 전 확인</h2>
              <p className="m-0 mt-1 text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">모든 항목이 준비되면 Meta에 광고를 보낼 수 있어요.</p>
            </div>
            <ReviewRow label="광고 목표" value={goal?.label ?? "목표를 선택해주세요"} ready={!!goal} onEdit={p.onEditBrief} />
            <ReviewRow label="광고 소재" value={creativeReady ? creative.state.headline : "소재를 선택해주세요"} ready={creativeReady} onEdit={p.onEditCreative} />
            <ReviewRow label="도착 링크" value={urlRequired ? (urlReady ? state.landingUrl : "https:// URL이 필요해요") : "목표에 따라 자동 연결"} ready={urlReady} onEdit={p.onBack} />
            <ReviewRow label="타겟" value={targetLabel} ready={targetReady} onEdit={p.onBack} />
            <ReviewRow label="게재 채널" value={state.platforms === "both" ? "Facebook · Instagram" : state.platforms === "facebook" ? "Facebook" : "Instagram"} ready onEdit={p.onBack} />
            <ReviewRow label="예산 · 기간" value={`하루 ${fmt(budget)}원 · ${days}일`} ready={budget > 0 && days > 0} onEdit={p.onBack} />
            <ReviewRow label="Meta 연결" value={accountReady ? (session?.browseMode ? "둘러보기 데모" : "광고 계정과 페이지 연결됨") : "광고 계정과 페이지를 연결해주세요"} ready={accountReady} onEdit={p.onBack} />
          </PanelCard>

          <div className="mt-3 rounded-[var(--w-radius-12)] border border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] font-semibold text-[var(--w-fg-normal)]">총 집행액</span>
              <strong className="text-[20px] leading-none text-[var(--w-fg-strong)]">{fmt(budget * days)}원</strong>
            </div>
          </div>

          {p.blockReason && (
            <div className="mt-3 flex items-start gap-2.5 rounded-[var(--w-radius-12)] bg-[var(--w-status-cautionary-soft)] px-3.5 py-3">
              <Icon name="warn" size={15} className="mt-0.5 shrink-0 text-[var(--w-status-cautionary)]" />
              <p className="m-0 text-[13px] font-medium leading-[1.6] text-[var(--w-fg-normal)]">{p.blockReason}</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2.5">
            <Button variant="secondary" size="lg" type="button" onClick={p.onBack}>← 게재 설정으로</Button>
            <div>
              <Button variant="primary" size="lg" type="button" onClick={p.onLaunch} disabled={!!p.blockReason || p.launching}>
                {p.launching ? "Meta에 전송하는 중…" : "Meta에 광고 게재하기"}
              </Button>
              <p className="m-0 mt-2 text-right text-[11px] leading-[1.4] text-[var(--w-fg-neutral)]">누르면 Meta 정책 검토가 시작돼요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
