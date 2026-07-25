"use client";

import { useLaunchDraft } from "@entities/campaign/model";
import { useCreativeDraft } from "@entities/creative/model";
import { COUNTRIES } from "@shared/lib/geo-options";
import { type Gender } from "@shared/lib/meta/targeting";
import AgeRange from "@shared/ui/AgeRange";
import SubHead from "./SubHead";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";
const chipAccent = "border-[var(--w-primary-normal)] text-[var(--w-primary-press)] bg-[var(--w-primary-soft)]";
const GENDER_OPTS: [Gender, string][] = [["all", "전체"], ["male", "남성"], ["female", "여성"]];

// ADR-022 — 연령·성별 출처 배지. 페르소나 override = 페르소나, AI 추천 = AI 추천.
function SourceBadge({ source }: { source: "persona" | "ai" }) {
  const persona = source === "persona";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: persona ? "var(--w-bg-neutral)" : "var(--w-primary-soft)",
      color: persona ? "var(--w-fg-neutral)" : "var(--w-primary-press)",
      font: "600 11px/1 var(--w-font-sans)", padding: "3px 8px", borderRadius: 20,
    }}>
      <Icon name={persona ? "users" : "sparkles"} size={10} /> {persona ? "페르소나" : "AI 추천"}
    </span>
  );
}

export default function TargetStep() {
  const { state, dispatch } = useLaunchDraft();
  const creative = useCreativeDraft();
  const targeting = creative.state.targeting;
  const source = creative.state.targetingSource;

  const toggleCountry = (code: string) => {
    const next = state.countries.includes(code)
      ? state.countries.filter((c) => c !== code)
      : [...state.countries, code];
    dispatch({ type: "SET_COUNTRIES", value: next });
  };

  return (
    <>
      <SubHead
        title="타겟"
        subtitle={
          targeting
            ? "연령·성별은 AI가 입력 내용을 보고 추천했어요. 그대로 두거나 조정해도 돼요."
            : "타겟 조건을 설정해주세요."
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5" style={{ marginBottom: 10 }}>
            연령
            {source && <SourceBadge source={source.age} />}
          </label>
          <AgeRange
            value={[state.ageMin, state.ageMax]}
            onChange={(v) => dispatch({ type: "SET_AGE_RANGE", min: v[0], max: v[1] })}
          />
        </div>
        <div>
          <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5" style={{ marginBottom: 8 }}>
            성별
            {source && <SourceBadge source={source.gender} />}
          </label>
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
            <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)]" style={{ marginTop: 8 }}>
              최소 1개 국가를 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
