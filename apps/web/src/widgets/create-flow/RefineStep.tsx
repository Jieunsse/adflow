"use client";

// 시안 2b — 다듬기. 확정한 안 하나만 놓고, 문장별 근거를 보며 고친다.
// 본문의 초록 밑줄 = 브랜드 프로필 근거 문구가 본문에 그대로 들어간 자리(evidence.ts 가 판정).

import { useRef } from "react";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import { cn } from "@shared/lib/cn";
import { CTA_LABEL, COPY_HOOK_MAP, type CopyHook, type CtaId } from "@entities/creative/options";
import { REFINE_PRESETS, type RefineId } from "@entities/creative/refine-presets";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { AdMockFull } from "./AdMockup";
import { PanelCard, SelectChip, StepHeaderBar } from "./parts";
import { highlightSegments, proofUsage } from "./evidence";
import { useBrandHandle } from "./useBrandHandle";

const BODY_LIMIT = 200;

const TEXT_LAYER = "font-normal text-[14px] leading-[1.9] tracking-[0.004em] whitespace-pre-wrap break-words px-3.5 py-3.5";

function HighlightTextarea({
  value,
  onChange,
  proofPoints,
}: {
  value: string;
  onChange: (v: string) => void;
  proofPoints: string[];
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const segments = highlightSegments(value, proofPoints);

  return (
    <div className="relative border border-[var(--w-line-normal)] rounded-[var(--w-radius-12)] overflow-hidden bg-[var(--w-bg-normal)] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-[var(--w-primary-normal)] focus-within:shadow-[0_0_0_4px_var(--w-focus-ring)]">
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(TEXT_LAYER, "absolute inset-0 overflow-hidden text-transparent pointer-events-none")}
      >
        {segments.map((s, i) =>
          s.hit ? (
            <mark
              key={i}
              className="bg-[var(--w-status-positive-soft)] text-transparent border-b-[1.5px] border-[var(--w-status-positive)] px-[2px]"
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
        {/* 마지막 줄바꿈이 잘려 배경이 한 줄 밀리는 걸 막는 여백 */}
        {"\n"}
      </div>
      <textarea
        className={cn(TEXT_LAYER, "relative block w-full min-h-[150px] bg-transparent text-[var(--w-fg-normal)] outline-none resize-y")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        aria-label="광고 본문"
      />
    </div>
  );
}

interface Props {
  savedLabel: string | null;
  verIdx: number;
  hook: CopyHook | null;
  headline: string;
  setHeadline: (v: string) => void;
  headlineCandidates: string[] | null;
  primaryText: string;
  setPrimaryText: (v: string) => void;
  cta: CtaId;
  imageUrl: string | null;
  refining: boolean;
  onRefine: (id: RefineId) => void;
  onBack: () => void;
  onNext: () => void;
  // 시안에는 없지만 기존 기능 — 확정한 안을 소재 라이브러리에 담아 둘 수 있게 남긴다.
  saved: boolean;
  onSaveToLibrary: () => void;
  goLibrary: () => void;
}

export default function RefineStep(p: Props) {
  const handle = useBrandHandle();
  const { data: session } = useSession();
  const { profile: bp } = useBrandProfileStorage(!!session?.browseMode);
  const proofPoints = (bp.proofPoints ?? []).filter((t) => t.trim());
  const usage = proofUsage(p.primaryText, proofPoints);
  const usedCount = usage.filter((u) => u.used).length;
  const missing = usage.filter((u) => !u.used);
  const overLimit = p.primaryText.length > BODY_LIMIT;

  const alternatives = (p.headlineCandidates ?? []).filter((h) => h && h !== p.headline);

  return (
    <div className="bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] overflow-hidden">
      <StepHeaderBar
        title="소재 다듬기"
        savedLabel={p.savedLabel}
        badge={
          <Chip variant="accent" size="sm">
            VER {String(p.verIdx + 1).padStart(2, "0")}
            {p.hook ? ` · ${COPY_HOOK_MAP[p.hook].ko}` : ""}
          </Chip>
        }
      >
        {p.saved ? (
          <Button variant="ghost" size="sm" type="button" onClick={p.goLibrary} title="소재 라이브러리에서 보기">
            <Icon name="check" size={13} className="text-[var(--w-status-positive)]" /> 라이브러리에 저장됨
          </Button>
        ) : (
          <Button variant="ghost" size="sm" type="button" onClick={p.onSaveToLibrary}>
            <Icon name="folder" size={13} /> 라이브러리에 저장
          </Button>
        )}
        <Button variant="ghost" size="sm" type="button" onClick={p.onBack}>
          ← 3안 비교로
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={p.onNext}>
          게재 설정으로 →
        </Button>
      </StepHeaderBar>

      <div className="flex gap-5 px-6 py-5 items-start">
        <PanelCard className="w-[400px] shrink-0 overflow-hidden rounded-[var(--w-radius-16)]">
          <AdMockFull
            handle={handle}
            imageUrl={p.imageUrl}
            headline={p.headline}
            body={p.primaryText}
            ctaLabel={CTA_LABEL[p.cta]}
          />
        </PanelCard>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <PanelCard className="p-[18px]">
            <div className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)] mb-2">헤드라인</div>
            <input
              className="w-full border border-[var(--w-line-normal)] rounded-[var(--w-radius-12)] px-3.5 py-[11px] bg-[var(--w-bg-normal)] font-semibold text-[15px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)]"
              value={p.headline}
              onChange={(e) => p.setHeadline(e.target.value)}
              aria-label="헤드라인"
            />
            {alternatives.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">다른 표현</span>
                {alternatives.map((h) => (
                  <SelectChip key={h} chipSize="sm" onClick={() => p.setHeadline(h)}>
                    {h}
                  </SelectChip>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard className="p-[18px]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">본문</span>
              <span
                className={cn(
                  "font-normal text-[12px] leading-[1.4]",
                  overLimit ? "text-[var(--w-status-negative)]" : "text-[var(--w-fg-neutral)]",
                )}
              >
                {p.primaryText.length} / {BODY_LIMIT}자
              </span>
            </div>
            <HighlightTextarea value={p.primaryText} onChange={p.setPrimaryText} proofPoints={proofPoints} />
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] font-semibold text-[12px] leading-[1.3]">
                <Icon name="sparkles" size={12} /> AI로 고치기
              </span>
              {REFINE_PRESETS.map((r) => (
                <SelectChip
                  key={r.id}
                  chipSize="sm"
                  disabled={p.refining}
                  onClick={() => p.onRefine(r.id)}
                >
                  {r.label}
                </SelectChip>
              ))}
              {p.refining && (
                <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">고치는 중…</span>
              )}
            </div>
          </PanelCard>

          {proofPoints.length > 0 && (
            <PanelCard className="p-[18px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">문장에 쓰인 근거</span>
                <Chip variant="success" size="sm">{usedCount}건 ✓</Chip>
              </div>
              <p className="m-0 mb-3 font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
                초록으로 표시된 문장은 브랜드 프로필에 적어 둔 근거 표현이에요.
              </p>
              <div className="flex flex-col gap-2">
                {usage.filter((u) => u.used).map((u) => (
                  <div
                    key={u.text}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--w-radius-12)] bg-[var(--w-status-positive-soft)]"
                  >
                    <span className="font-semibold text-[12px] leading-[1.4] text-[var(--w-status-positive)] shrink-0">확인됨</span>
                    <span className="flex-1 font-normal text-[13px] leading-[1.5] text-[var(--w-fg-normal)]">{u.text}</span>
                  </div>
                ))}
                {missing.map((u) => (
                  <div
                    key={u.text}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--w-radius-12)] bg-[var(--w-status-cautionary-soft)]"
                  >
                    <span className="font-semibold text-[12px] leading-[1.4] text-[var(--w-status-cautionary)] shrink-0">근거 없음</span>
                    <span className="flex-1 font-normal text-[13px] leading-[1.5] text-[var(--w-fg-normal)]">
                      “{u.text}” — 이번 본문에서는 빠졌어요
                    </span>
                    <button
                      type="button"
                      onClick={() => p.setPrimaryText(`${p.primaryText.trimEnd()}\n${u.text}`)}
                      className="font-medium text-[12px] leading-[1.4] text-[var(--w-primary-normal)] cursor-pointer shrink-0"
                    >
                      문장 추가
                    </button>
                  </div>
                ))}
              </div>
            </PanelCard>
          )}
        </div>
      </div>
    </div>
  );
}
