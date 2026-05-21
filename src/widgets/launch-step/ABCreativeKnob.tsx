"use client";

import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
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

  // 헤드라인 축: pool 변화 시 자동 초기화
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

  // 카피문구 축: candidates 변화 시 자동 초기화
  useEffect(() => {
    if (!state.abTestEnabled || axis !== "primary_text") return;
    const pool = (primaryTextCandidates ?? []).filter((t) => t !== primaryTextA);
    if (pool.length === 0) return;
    if (!variantBPrimaryText || !pool.includes(variantBPrimaryText)) {
      dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "primary_text", primaryText: pool[0] } });
    }
  }, [state.abTestEnabled, axis, variantBPrimaryText, primaryTextCandidates, primaryTextA, dispatch]);

  // 축 변경 시 abTestAxis + variantB 동기화
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
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <input
          type="checkbox"
          style={{ marginTop: 3 }}
          checked={state.abTestEnabled}
          onChange={(e) => dispatch({ type: "SET_AB_TEST_ENABLED", enabled: e.target.checked })}
        />
        <div>
          <div style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            A/B 시험으로 집행
          </div>
          <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "3px 0 0" }}>
            두 개를 같은 광고세트에 등록해 성과를 비교해요. 7일 후 우세한 쪽 안내(예정).
          </p>
        </div>
      </label>

      {state.abTestEnabled && (
        <div style={{ margin: "14px 0 4px 28px" }}>
          {/* 축 선택 탭 */}
          <SubHead title="비교 축 선택" subtitle="어떤 요소를 비교할지 골라주세요." />
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {AXIS_TABS.map((t) => {
              const on = axis === t.id;
              const available = axisAvailable[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => available && switchAxis(t.id)}
                  disabled={!available}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: on ? "1.5px solid var(--w-primary-normal)" : "1.5px solid var(--w-line-alternative)",
                    background: on ? "var(--w-primary-soft)" : "var(--w-bg-normal)",
                    color: on ? "var(--w-primary-press)" : available ? "var(--w-fg-neutral)" : "var(--w-fg-alternative)",
                    font: "600 12.5px/1 var(--w-font-sans)",
                    cursor: available ? "pointer" : "not-allowed",
                    opacity: available ? 1 : 0.5,
                  }}
                  title={available ? t.desc : `${t.label} 축을 사용하려면 ${t.id === "headline" ? "AI 카피 후보가 2개 이상 필요해요" : t.id === "image" ? "AI 이미지를 먼저 생성해주세요" : "카피 문구가 필요해요"}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 헤드라인 축 */}
          {axis === "headline" && headlineAvailable && (
            <HeadlineAxis
              headlineA={headlineA}
              options={variantBOptions}
              selected={variantBHeadline}
              onSelect={(h) => dispatch({ type: "SET_AB_TEST_VARIANT_B", value: { axis: "headline", headline: h } })}
            />
          )}

          {/* 카피문구 축 */}
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

          {/* 이미지 축 */}
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

function HeadlineAxis({ headlineA, options, selected, onSelect }: {
  headlineA: string;
  options: string[];
  selected: string | null;
  onSelect: (h: string) => void;
}) {
  return (
    <>
      <SubHead title="B안 헤드라인 선택" subtitle="A안은 STEP 01에서 고른 헤드라인이에요. B안만 골라주세요." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="radio-card radio-card--on" style={{ opacity: 0.85 }}>
          <div className="radio-card__indicator" />
          <div style={{ flex: 1 }}>
            <div className="radio-card__num">A안 (고정)</div>
            <div className="radio-card__text">{headlineA}</div>
          </div>
        </div>
        {options.map((h) => {
          const on = selected === h;
          return (
            <div
              key={h}
              className={"radio-card" + (on ? " radio-card--on" : "")}
              onClick={() => onSelect(h)}
              role="radio"
              aria-checked={on}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect(h); } }}
            >
              <div className="radio-card__indicator" />
              <div style={{ flex: 1 }}>
                <div className="radio-card__num">B안</div>
                <div className="radio-card__text">{h}</div>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="radio-card radio-card--on" style={{ opacity: 0.85 }}>
          <div className="radio-card__indicator" />
          <div style={{ flex: 1 }}>
            <div className="radio-card__num">A안 (고정)</div>
            <div className="radio-card__text">{textA || "카피 문구 없음"}</div>
          </div>
        </div>
        {hasOptions ? (
          options.map((t) => {
            const on = selected === t;
            return (
              <div
                key={t}
                className={"radio-card" + (on ? " radio-card--on" : "")}
                onClick={() => onSelect(t)}
                role="radio"
                aria-checked={on}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect(t); } }}
              >
                <div className="radio-card__indicator" />
                <div style={{ flex: 1 }}>
                  <div className="radio-card__num">B안</div>
                  <div className="radio-card__text">{t}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--w-primary-normal)", background: "var(--w-bg-normal)" }}>
            <div style={{ font: "600 11.5px/1 var(--w-font-sans)", color: "var(--w-primary-press)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>B안</div>
            <textarea
              value={textB}
              onChange={(e) => onChangeB(e.target.value)}
              placeholder="비교할 카피 문구를 입력해주세요"
              rows={3}
              style={{
                width: "100%", border: "none", background: "transparent", resize: "vertical",
                font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-strong)",
                outline: "none", padding: 0,
              }}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <img src={aImg} alt="A안" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "2px solid var(--w-line-normal)", opacity: 0.8 }} />
          <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", font: "700 11px/1 var(--w-font-sans)", padding: "3px 7px", borderRadius: 6 }}>A안 (고정)</span>
        </div>
        {bOptions.map((url, i) => {
          const idx = i + 1;
          const on = selectedBIndex === idx;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onSelectB(url)}
              style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 10 }}
            >
              <img src={url} alt={`B안 후보 ${idx}`} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: on ? "2.5px solid var(--w-primary-normal)" : "2px solid var(--w-line-alternative)" }} />
              {on && <span style={{ position: "absolute", top: 6, left: 6, background: "var(--w-primary-normal)", color: "#fff", font: "700 11px/1 var(--w-font-sans)", padding: "3px 7px", borderRadius: 6 }}>B안</span>}
              {!on && <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.45)", color: "#fff", font: "700 11px/1 var(--w-font-sans)", padding: "3px 7px", borderRadius: 6 }}>선택</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
