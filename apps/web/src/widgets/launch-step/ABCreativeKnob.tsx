"use client";

import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import type { AbTestAxis } from "@entities/campaign/model";
import SubHead from "./SubHead";

const AXIS_TABS: { id: AbTestAxis; label: string; desc: string }[] = [
  { id: "headline", label: "헤드라인", desc: "제목 문구 두 개를 비교해요" },
  { id: "primary_text", label: "카피 문구", desc: "본문 광고 문구 두 개를 비교해요" },
  { id: "image", label: "이미지", desc: "광고 이미지 두 개를 비교해요" },
];

export default function ABCreativeKnob() {
  const { state, dispatch } = useLaunchDraft();
  const { state: creative } = useCreativeDraft();

  const [axis, setAxis] = useState<AbTestAxis>(state.abTestAxis ?? "headline");

  const candidates = creative.headlineCandidates;
  const headlineA = creative.headline;
  const variantBOptions = (candidates ?? []).filter((h) => h !== headlineA);
  const headlineAvailable = variantBOptions.length >= 1;

  const primaryTextA = creative.primaryText;
  const primaryTextAvailable = !!primaryTextA;
  const primaryTextCandidates = creative.primaryTextCandidates;
  const primaryTextOptions = (primaryTextCandidates ?? []).filter((t) => t !== primaryTextA);

  const generatedImages = creative.generatedImages;
  const imageAvailable = !!(generatedImages && generatedImages.length >= 2);

  const axisAvailable: Record<AbTestAxis, boolean> = {
    headline: headlineAvailable,
    primary_text: primaryTextAvailable,
    image: imageAvailable,
  };

  const variantB = state.abTestVariantB;
  const variantBHeadline = variantB?.axis === "headline" ? variantB.headline : null;
  const variantBPrimaryText = variantB?.axis === "primary_text" ? variantB.primaryText : null;

  useEffect(() => {
    if (!state.abTestEnabled || axis !== "headline") return;
    const pool = (candidates ?? []).filter((h) => h !== headlineA);
    if (pool.length === 0) {
      dispatch({ type: "SET_AB_TEST_ENABLED", enabled: false });
      return;
    }
    if (!variantBHeadline || !pool.includes(variantBHeadline)) {
      dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "headline", headline: pool[0] } });
    }
  }, [state.abTestEnabled, axis, variantBHeadline, candidates, headlineA, dispatch]);

  useEffect(() => {
    if (!state.abTestEnabled || axis !== "primary_text") return;
    const pool = (primaryTextCandidates ?? []).filter((t) => t !== primaryTextA);
    if (pool.length === 0) return;
    if (!variantBPrimaryText || !pool.includes(variantBPrimaryText)) {
      dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "primary_text", primaryText: pool[0] } });
    }
  }, [state.abTestEnabled, axis, variantBPrimaryText, primaryTextCandidates, primaryTextA, dispatch]);

  const switchAxis = (next: AbTestAxis) => {
    setAxis(next);
    dispatch({ type: "SET_AB_TEST_AXIS", axis: next });
    if (next === "headline") {
      const pool = (candidates ?? []).filter((h) => h !== headlineA);
      if (pool[0]) dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "headline", headline: pool[0] } });
    } else if (next === "primary_text") {
      const pool = (primaryTextCandidates ?? []).filter((t) => t !== primaryTextA);
      dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "primary_text", primaryText: pool[0] ?? "" } });
    } else {
      const imgB = generatedImages?.[1] ?? generatedImages?.[0] ?? "";
      dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "image", imageDataUrl: imgB } });
    }
  };

  return (
    <>
      <label className="flex items-start gap-2.5 mb-1">
        <input
          type="checkbox"
          className="mt-[3px]"
          checked={state.abTestEnabled}
          onChange={(e) => dispatch({ type: "SET_AB_TEST_ENABLED", enabled: e.target.checked })}
        />
        <div>
          <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
            A/B 시험으로 집행
          </div>
          <p className="font-normal text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px] mb-0">
            두 개를 같은 광고세트에 등록해 성과를 비교해요. 7일 후 우세한 쪽 안내(예정).
          </p>
        </div>
      </label>

      {state.abTestEnabled && (
        <div className="ml-7 mt-3.5 mb-1">
          <SubHead title="비교 축 선택" subtitle="어떤 요소를 비교할지 골라주세요." />
          <div className="flex gap-2 mb-4 flex-wrap">
            {AXIS_TABS.map((t) => {
              const on = axis === t.id;
              const available = axisAvailable[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => available && switchAxis(t.id)}
                  disabled={!available}
                  className={cn(
                    "px-[14px] py-[7px] rounded-lg border font-semibold text-[13px] leading-none cursor-pointer",
                    on
                      ? "border-[1.5px] border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]"
                      : available
                        ? "border-[1.5px] border-[var(--w-line-alternative)] bg-[var(--w-bg-normal)] text-[var(--w-fg-neutral)]"
                        : "border-[1.5px] border-[var(--w-line-alternative)] bg-[var(--w-bg-normal)] text-[var(--w-fg-alternative)] opacity-50 cursor-not-allowed"
                  )}
                  title={available ? t.desc : `${t.label} 축을 사용하려면 ${t.id === "headline" ? "AI 카피 후보가 2개 이상 필요해요" : t.id === "image" ? "AI 이미지를 먼저 생성해주세요" : "카피 문구가 필요해요"}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {axis === "headline" && headlineAvailable && (
            <HeadlineAxis
              headlineA={headlineA}
              options={variantBOptions}
              selected={variantBHeadline}
              onSelect={(h) => dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "headline", headline: h } })}
            />
          )}

          {axis === "primary_text" && (
            <PrimaryTextAxis
              textA={primaryTextA}
              options={primaryTextOptions}
              selected={variantBPrimaryText}
              onSelect={(v) => dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "primary_text", primaryText: v } })}
              textB={variantB?.axis === "primary_text" ? variantB.primaryText : ""}
              onChangeB={(v) => dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "primary_text", primaryText: v } })}
            />
          )}

          {axis === "image" && imageAvailable && (
            <ImageAxis
              images={generatedImages!}
              selectedBIndex={
                variantB?.axis === "image" && generatedImages
                  ? generatedImages.indexOf(variantB.imageDataUrl)
                  : 1
              }
              onSelectB={(url) => dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "image", imageDataUrl: url } })}
            />
          )}
        </div>
      )}
    </>
  );
}

const radioCardBase = "flex items-start gap-3 p-[14px_16px] border border-[var(--w-line-normal)] rounded-xl cursor-pointer bg-[var(--w-bg-elevated)] transition-[border-color,background] duration-[120ms] hover:bg-[var(--w-bg-neutral)]";
const radioCardOn = "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] hover:bg-[var(--w-primary-soft)]";

function RadioIndicator({ on }: { on: boolean }) {
  return (
    <span className={cn(
      "w-[18px] h-[18px] rounded-full border-[1.5px] shrink-0 mt-[1px] relative",
      on ? "border-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)]"
    )}>
      {on && <span className="absolute inset-[3px] rounded-full bg-[var(--w-primary-normal)]" />}
    </span>
  );
}

function HeadlineAxis({ headlineA, options, selected, onSelect }: {
  headlineA: string;
  options: string[];
  selected: string | null;
  onSelect: (h: string) => void;
}) {
  return (
    <>
      <SubHead title="B안 헤드라인 선택" subtitle="A안은 STEP 01에서 고른 헤드라인이에요. B안만 골라주세요." />
      <div className="flex flex-col gap-2">
        <div className={cn(radioCardBase, radioCardOn, "opacity-85")}>
          <RadioIndicator on={true} />
          <div className="flex-1">
            <div className="font-semibold text-[11px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">A안 (고정)</div>
            <div className="font-semibold text-[15px] leading-[1.45] text-[var(--w-fg-strong)] mt-1">{headlineA}</div>
          </div>
        </div>
        {options.map((h) => {
          const on = selected === h;
          return (
            <div
              key={h}
              className={cn(radioCardBase, on && radioCardOn)}
              onClick={() => onSelect(h)}
              role="radio"
              aria-checked={on}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect(h); } }}
            >
              <RadioIndicator on={on} />
              <div className="flex-1">
                <div className="font-semibold text-[11px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">B안</div>
                <div className="font-semibold text-[15px] leading-[1.45] text-[var(--w-fg-strong)] mt-1">{h}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PrimaryTextAxis({ textA, options, selected, onSelect, textB, onChangeB }: {
  textA: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string) => void;
  textB: string;
  onChangeB: (v: string) => void;
}) {
  const hasOptions = options.length >= 1;
  return (
    <>
      <SubHead
        title={hasOptions ? "B안 카피 문구 선택" : "B안 카피 문구 입력"}
        subtitle={hasOptions ? "A안은 STEP 01에서 고른 카피예요. B안만 골라주세요." : "A안은 STEP 01에서 작성한 카피예요. B안을 직접 입력해주세요."}
      />
      <div className="flex flex-col gap-2">
        <div className={cn(radioCardBase, radioCardOn, "opacity-85")}>
          <RadioIndicator on={true} />
          <div className="flex-1">
            <div className="font-semibold text-[11px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">A안 (고정)</div>
            <div className="font-semibold text-[15px] leading-[1.45] text-[var(--w-fg-strong)] mt-1">{textA || "카피 문구 없음"}</div>
          </div>
        </div>
        {hasOptions ? (
          options.map((t) => {
            const on = selected === t;
            return (
              <div
                key={t}
                className={cn(radioCardBase, on && radioCardOn)}
                onClick={() => onSelect(t)}
                role="radio"
                aria-checked={on}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect(t); } }}
              >
                <RadioIndicator on={on} />
                <div className="flex-1">
                  <div className="font-semibold text-[11px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">B안</div>
                  <div className="font-semibold text-[15px] leading-[1.45] text-[var(--w-fg-strong)] mt-1">{t}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-3 rounded-[10px] border-[1.5px] border-[var(--w-primary-normal)] bg-[var(--w-bg-normal)]">
            <div className="font-semibold text-[12px] leading-none text-[var(--w-primary-press)] mb-2 uppercase tracking-[0.06em]">B안</div>
            <textarea
              value={textB}
              onChange={(e) => onChangeB(e.target.value)}
              placeholder="비교할 카피 문구를 입력해주세요"
              rows={3}
              className="w-full border-none bg-transparent resize-y font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] outline-none p-0"
            />
          </div>
        )}
      </div>
    </>
  );
}

function ImageAxis({ images, selectedBIndex, onSelectB }: {
  images: [string, string, string];
  selectedBIndex: number;
  onSelectB: (url: string) => void;
}) {
  const aImg = images[0];
  const bOptions = [images[1], images[2]].filter(Boolean);
  return (
    <>
      <SubHead title="B안 이미지 선택" subtitle="A안은 첫 번째 이미지예요. B안으로 비교할 이미지를 골라주세요." />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="relative">
          <img src={aImg} alt="A안" className="w-full aspect-square object-cover rounded-[10px] border-2 border-[var(--w-line-normal)] opacity-80" />
          <span className="absolute top-1.5 left-1.5 bg-[rgba(0,0,0,0.55)] text-white font-bold text-[11px] leading-none px-[7px] py-[3px] rounded-md">A안 (고정)</span>
        </div>
        {bOptions.map((url, i) => {
          const idx = i + 1;
          const on = selectedBIndex === idx;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onSelectB(url)}
              className="relative p-0 border-none bg-none cursor-pointer rounded-[10px]"
            >
              <img
                src={url}
                alt={`B안 후보 ${idx}`}
                className={cn(
                  "w-full aspect-square object-cover rounded-[10px]",
                  on ? "border-[2.5px] border-[var(--w-primary-normal)]" : "border-2 border-[var(--w-line-alternative)]"
                )}
              />
              {on && <span className="absolute top-1.5 left-1.5 bg-[var(--w-primary-normal)] text-white font-bold text-[11px] leading-none px-[7px] py-[3px] rounded-md">B안</span>}
              {!on && <span className="absolute top-1.5 left-1.5 bg-[rgba(0,0,0,0.45)] text-white font-bold text-[11px] leading-none px-[7px] py-[3px] rounded-md">선택</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
