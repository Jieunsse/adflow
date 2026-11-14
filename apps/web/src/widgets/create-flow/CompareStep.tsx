"use client";

// 시안 1c — 3안 목업 스프레드. 실제 광고 모습 그대로 좌우로 놓고 고른다.
// 아래 "3안이 다른 점" 표는 같은 조건에서 무엇이 달라졌는지만 모은다.

import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import type { CopyHook } from "@entities/creative/options";
import type { CreativeAttribution } from "@/lib/gemini-creative";
import type { ProfileNudge } from "@entities/creative/profile-nudge";
import { AdMockCompact } from "./AdMockup";
import ConditionRail from "./ConditionRail";
import { StepHeaderBar, VerLabel, selectionRing } from "./parts";
import { evidenceNote, lengthNote, openingStyle } from "./copy-diff";
import { pickBrowseShots } from "./browse-images";
import { useBrandHandle } from "./useBrandHandle";

interface Props {
  savedLabel: string | null;
  headlines: string[];
  primaryTexts: string[];
  hooks: [CopyHook, CopyHook, CopyHook] | null;
  proofPointsCited: [boolean, boolean, boolean] | null;
  selectedIdx: number;
  onSelect: (i: number) => void;
  imageUrl: string | null;
  browseMode: boolean;
  personaId: string | null;
  regenerating: boolean;
  onRegenerate: () => void;
  onEditBrief: () => void;
  onNext: () => void;
  // ADR-052 — 보상 루프. 시안에는 없지만 기존 기능이라 3안 아래 한 줄 띠로 살려 둔다.
  attribution: CreativeAttribution | null;
  nudge: ProfileNudge | null;
  onNudgeAdd: () => void;
  addedLabel: string | null;
  /** 넛지로 필드를 채운 뒤의 재생성 — before/after 스냅샷이 붙는다. */
  onRegenerateAfterAdd: () => void;
  beforeAfter: { before: string; label: string } | null;
}

// ADR-052 — "전달한 재료(injected)" 칩 라벨.
const INJECTED_LABEL: Record<CreativeAttribution["injected"][number], string> = {
  tone: "톤",
  brandVoice: "브랜드 보이스",
  customerVoice: "고객의 말",
  imageGuide: "이미지 가이드",
  persona: "페르소나",
  product: "제품",
  copyReferences: "카피 문체",
};

function DiffRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <>
      <div className="px-4 py-[11px] font-semibold text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] bg-[var(--w-bg-neutral)]">
        {label}
      </div>
      {cells.map((c, i) => (
        <div key={i} className="px-3.5 py-[11px] font-normal text-[13px] leading-[1.6] text-[var(--w-fg-normal)]">
          {c}
        </div>
      ))}
    </>
  );
}

export default function CompareStep(p: Props) {
  const handle = useBrandHandle();
  const idxs = [0, 1, 2];
  const browseImages = p.browseMode && !p.imageUrl ? pickBrowseShots(null) : null;

  return (
    <div className="bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] overflow-hidden">
      <StepHeaderBar title="소재 3안 비교" savedLabel={p.savedLabel}>
        <Button variant="secondary" size="sm" type="button" onClick={p.onRegenerate} disabled={p.regenerating}>
          <Icon name="sparkles" size={13} /> 3안 다시 생성
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={p.onNext}>
          선택한 안으로 진행 →
        </Button>
      </StepHeaderBar>

      <div className="flex items-start gap-5 px-6 py-5">
        <ConditionRail personaId={p.personaId} onEdit={p.onEditBrief} />

        <div className="flex-1 min-w-0 flex gap-3.5">
          {idxs.map((i) => {
            const selected = p.selectedIdx === i;
            return (
              <div
                key={i}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => p.onSelect(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    p.onSelect(i);
                  }
                }}
                className="flex-1 min-w-0 bg-[var(--w-bg-normal)] rounded-[var(--w-radius-16)] p-3 cursor-pointer transition-[box-shadow] duration-150"
                style={{ boxShadow: selectionRing(selected) }}
              >
                <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
                  <VerLabel index={i} hook={p.hooks?.[i]} />
                  <span className="flex-1" />
                  {selected && (
                    <span className="font-semibold text-[11px] leading-[1.3] text-[var(--w-primary-normal)]">
                      ● 선택됨
                    </span>
                  )}
                </div>
                <AdMockCompact
                  handle={handle}
                  imageUrl={p.imageUrl ?? browseImages?.[i].url ?? null}
                  headline={p.headlines[i] ?? ""}
                  body={p.primaryTexts[i] ?? ""}
                />
              </div>
            );
          })}
        </div>
      </div>

      {p.beforeAfter && (
        <div className="flex items-start gap-2.5 mx-6 mb-3 px-3.5 py-3 rounded-[var(--w-radius-12)] bg-[var(--w-status-positive-soft)] border border-[var(--w-status-positive-line)]">
          <Icon name="check" size={15} className="text-[var(--w-status-positive)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">
              {p.beforeAfter.label} 반영해 다시 만들었어요
            </div>
            <p className="m-0 mt-1 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] truncate">
              이전 안: {p.beforeAfter.before}{" "}
              <span className="text-[var(--w-fg-alternative)]">({p.beforeAfter.label} 미반영)</span>
            </p>
          </div>
        </div>
      )}

      {p.addedLabel ? (
        <div className="flex items-center gap-2.5 mx-6 mb-3 px-3.5 py-3 rounded-[var(--w-radius-12)] bg-[var(--w-primary-soft)] border border-[var(--w-primary-normal)]">
          <Icon name="sparkles" size={15} className="text-[var(--w-primary-normal)] shrink-0" />
          <p className="m-0 flex-1 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-strong)]">
            {p.addedLabel} 추가됨 — 다시 생성하면 카피에 반영돼요.
          </p>
          <Button variant="primary" size="sm" type="button" onClick={p.onRegenerateAfterAdd}>
            <Icon name="sparkles" size={12} /> 추가하고 다시 생성
          </Button>
        </div>
      ) : p.nudge ? (
        <div className="flex items-center gap-2.5 mx-6 mb-3 px-3.5 py-3 rounded-[var(--w-radius-12)] bg-[var(--w-accent-violet-soft)]">
          <Icon name="sparkles" size={15} className="text-[var(--w-accent-violet)] shrink-0" />
          <p className="m-0 flex-1 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-normal)]">{p.nudge.reason}</p>
          <Button variant="secondary" size="sm" type="button" onClick={p.onNudgeAdd}>
            추가하기
          </Button>
        </div>
      ) : null}

      {p.attribution && (p.attribution.reflected.length > 0 || p.attribution.injected.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap mx-6 mb-3 px-3.5 py-3 rounded-[var(--w-radius-12)] bg-[var(--w-bg-normal)] shadow-[var(--w-shadow-card)]">
          <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">
            이 카피에 쓰인 브랜드 정보
          </span>
          {p.attribution.reflected.includes("proofPoints") && (
            <span
              title="브랜드 근거 자료의 수치를 실제로 인용했어요 (ADR-031)"
              className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)] font-semibold text-[12px] leading-none"
            >
              <Icon name="check" size={11} /> 근거 자료 반영 ✓
            </span>
          )}
          {p.attribution.injected.map((key) => (
            <span
              key={key}
              title="AI에 전달한 재료예요. 출력 반영 여부는 검증하지 않아요."
              className="inline-flex items-center px-2.5 py-[3px] rounded-full border border-[var(--w-line-normal)] text-[var(--w-fg-normal)] font-medium text-[12px] leading-none"
            >
              {INJECTED_LABEL[key]} 전달함
            </span>
          ))}
        </div>
      )}

      <div className="mx-6 mb-5 bg-[var(--w-bg-normal)] rounded-[var(--w-radius-12)] shadow-[var(--w-shadow-card)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--w-line-alternative)]">
          <span className="font-bold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">3안이 다른 점</span>
          <span className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">
            같은 조건에서 무엇이 달라졌는지만 모아 봤어요
          </span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "112px 1fr 1fr 1fr" }}>
          <DiffRow label="여는 방식" cells={idxs.map((i) => openingStyle(p.hooks?.[i]))} />
          <DiffRow label="주요 근거" cells={idxs.map((i) => evidenceNote(p.proofPointsCited?.[i]))} />
          <DiffRow label="문장 길이" cells={idxs.map((i) => lengthNote(p.primaryTexts[i], p.hooks?.[i]))} />
        </div>
      </div>
    </div>
  );
}
