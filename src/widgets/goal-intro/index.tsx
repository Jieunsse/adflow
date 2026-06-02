"use client";

// PRD §13.10 Q1 (B 결정) — outcome 미선택 시 노출되는 intro 화면.
// 2단계 흐름: 1) 4개 대분류 카테고리 → 2) 카테고리 내 세부 목표 선택.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { OBJECTIVES_PHASE1, type ObjectiveId } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";
import { readBrandProfile } from "@features/brand-profile/model/useBrandProfileStorage";
import type { CampaignSuggestion } from "@/lib/gemini-suggest-campaign";

interface Props {
  onNext: () => void;
}

interface GoalCardProps {
  id: ObjectiveId;
  iconName: Parameters<typeof Icon>[0]["name"];
  label: string;
  copyTone: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface CategoryCardProps {
  iconName: Parameters<typeof Icon>[0]["name"];
  label: string;
  desc: string;
  onClick: () => void;
}

const GOAL_CATEGORIES = [
  {
    id: "visit",
    label: "방문 유도",
    desc: "관심 있는 사람을 웹사이트·페이지로 보내 다음 행동을 유도해요",
    iconName: "globe" as const,
    goalIds: ["traffic", "traffic_page_visit"] as ObjectiveId[],
  },
  {
    id: "engage",
    label: "참여 늘리기",
    desc: "좋아요·댓글·메시지로 고객과의 접점을 넓혀요",
    iconName: "heart" as const,
    goalIds: ["engagement", "engagement_page_likes", "engagement_messages"] as ObjectiveId[],
  },
  {
    id: "awareness",
    label: "브랜드 알리기",
    desc: "최대한 많은 사람에게 노출해 처음 만나는 고객에게 각인시켜요",
    iconName: "megaphone" as const,
    goalIds: ["awareness"] as ObjectiveId[],
  },
  {
    id: "action",
    label: "행동 유도",
    desc: "전화 문의·콘텐츠 홍보로 즉각적인 반응을 이끌어요",
    iconName: "phone" as const,
    goalIds: ["leads_call", "boost_post"] as ObjectiveId[],
  },
] as const;

function CategoryCard({ iconName, label, desc, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-row items-center gap-4 p-5 rounded-[18px] border-[1.5px] border-transparent bg-[var(--w-bg-normal)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-[160ms] w-full hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(0,0,0,0.06),0_10px_24px_rgba(0,0,0,0.08)] hover:border-[var(--w-line-normal)]"
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(0, 102, 255, 0.06)",
          color: "var(--w-primary-press)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name={iconName} size={22} strokeWidth={1.7} />
      </div>
      <div>
        <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ font: "500 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

function GoalCard({ id, iconName, label, copyTone, active, disabled, onClick }: GoalCardProps) {
  return (
    <button
      key={id}
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "곧 열려요 — Pixel/Lead Form/App SDK 등 추가 인프라가 필요한 광고 목표예요" : copyTone}
      className={cn(
        "relative flex flex-col gap-[22px] p-[44px_18px] min-h-[200px] rounded-[18px] border-[1.5px] border-transparent bg-[var(--w-bg-normal)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-[160ms] w-full items-center justify-center",
        "hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(0,0,0,0.06),0_10px_24px_rgba(0,0,0,0.08)] disabled:hover:translate-y-0",
        active && "border-[var(--w-accent-violet)] bg-[rgba(101,65,242,0.025)] shadow-[0_0_0_3px_rgba(101,65,242,0.08),0_6px_18px_rgba(101,65,242,0.12)]"
      )}
      style={{
        color: active ? "var(--w-accent-violet)" : "var(--w-fg-strong)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {disabled && (
        <span style={{
          position: "absolute",
          top: 12,
          right: 14,
          font: "600 10px/1 var(--w-font-sans)",
          padding: "4px 8px",
          borderRadius: 6,
          background: "var(--w-accent-violet)",
          color: "#fff",
          letterSpacing: 0.2,
        }}>곧</span>
      )}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: active ? "var(--w-primary-soft)" : "rgba(0, 102, 255, 0.06)",
          color: active ? "var(--w-accent-violet)" : "var(--w-primary-press)",
          display: "grid",
          placeItems: "center",
          transition: "background 120ms ease, color 120ms ease",
        }}
      >
        <Icon name={iconName} size={32} strokeWidth={1.7} />
      </div>
      <span style={{
        font: "700 15px/1.3 var(--w-font-sans)",
        textAlign: "center",
        color: active ? "var(--w-accent-violet)" : "var(--w-fg-strong)",
      }}>
        {label}
      </span>
    </button>
  );
}

function readRecentObjectives(): string[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith("adflow:launched:"))
      .map((k) => {
        try {
          const data = JSON.parse(localStorage.getItem(k) ?? "{}") as { goalId?: string };
          return data.goalId ?? null;
        } catch { return null; }
      })
      .filter((v): v is string => !!v)
      .slice(-5);
  } catch { return []; }
}

const SUGGEST_CACHE_KEY = "adflow:suggest-cache";

function suggestSignature(
  bp: { brandDescription?: string; brandVoice?: string; tone?: string },
  recentObjectives: string[]
): string {
  return JSON.stringify({
    d: bp.brandDescription ?? "",
    v: bp.brandVoice ?? "",
    t: bp.tone ?? "",
    r: recentObjectives,
  });
}

export default function GoalIntro({ onNext }: Props) {
  const creative = useCreativeDraft();
  const outcome = creative.state.outcome;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const handleSuggest = () => {
    const bp = readBrandProfile();
    const recentObjectives = readRecentObjectives();
    const sig = suggestSignature(bp, recentObjectives);

    try {
      const cached = JSON.parse(localStorage.getItem(SUGGEST_CACHE_KEY) ?? "null") as
        | { sig: string; suggestions: CampaignSuggestion[] }
        | null;
      if (cached && cached.sig === sig && cached.suggestions?.length === 3) {
        setSuggestions(cached.suggestions);
        return;
      }
    } catch { /* 캐시 미스 → fetch */ }

    setSuggestLoading(true);
    fetch("/api/suggest-next-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandDescription: bp.brandDescription,
        brandVoice: bp.brandVoice,
        tone: bp.tone,
        recentObjectives,
      }),
    })
      .then((r) => r.json())
      .then((data: { suggestions?: CampaignSuggestion[] }) => {
        if (Array.isArray(data.suggestions) && data.suggestions.length === 3) {
          setSuggestions(data.suggestions);
          try {
            localStorage.setItem(SUGGEST_CACHE_KEY, JSON.stringify({ sig, suggestions: data.suggestions }));
          } catch { /* 저장 실패 무시 */ }
        }
      })
      .catch(() => { /* 실패 시 null 유지 → 버튼으로 복귀 */ })
      .finally(() => setSuggestLoading(false));
  };

  const handleCategoryClick = (categoryId: string) => {
    const cat = GOAL_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    if (cat.goalIds.length === 1) {
      creative.dispatch({ type: "SET_OUTCOME", outcome: cat.goalIds[0] });
      onNext();
    } else {
      creative.dispatch({ type: "SET_OUTCOME", outcome: null });
      setSelectedCategory(categoryId);
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    creative.dispatch({ type: "SET_OUTCOME", outcome: null });
  };

  const handleSelect = (id: ObjectiveId) => {
    creative.dispatch({ type: "SET_OUTCOME", outcome: id === outcome ? null : id });
  };

  if (selectedCategory) {
    const cat = GOAL_CATEGORIES.find((c) => c.id === selectedCategory)!;
    const subGoals = OBJECTIVES_PHASE1.filter((o) =>
      (cat.goalIds as readonly string[]).includes(o.id)
    );
    const colCount = subGoals.length <= 2 ? subGoals.length : 3;

    return (
      <Card variant="lg" style={{ padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--w-fg-neutral)",
              font: "500 13px/1 var(--w-font-sans)",
              padding: 0,
            }}
          >
            <Icon name="arrow-left" size={14} /> 목표 유형
          </button>
          <span style={{ color: "var(--w-line-normal)" }}>/</span>
          <span style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{cat.label}</span>
        </div>

        <div style={{ marginBottom: 18 }}>
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
            {cat.label} — 세부 목표를 골라주세요
          </h2>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
            광고 목표에 따라 AI 카피와 Meta 캠페인 설정이 자동으로 맞춰져요.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            gap: 14,
          }}
        >
          {subGoals.map((o) => (
            <GoalCard
              key={o.id}
              id={o.id}
              iconName={o.iconName}
              label={o.outcomeLabel}
              copyTone={o.copyTone}
              active={outcome === o.id}
              onClick={() => handleSelect(o.id)}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={onNext}
            disabled={!outcome}
            title={!outcome ? "광고 목표를 먼저 골라주세요" : undefined}
            style={{ minWidth: 240 }}
          >
            다음
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="lg" style={{ padding: 32 }}>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">어떤 광고를 만들까요?</h2>
        <Badge kind="neutral">필수</Badge>
      </div>
      <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0" style={{ marginBottom: 24 }}>
        목표 유형을 먼저 고르면 세부 목표를 안내해 드려요.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {GOAL_CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.id}
            iconName={cat.iconName}
            label={cat.label}
            desc={cat.desc}
            onClick={() => handleCategoryClick(cat.id)}
          />
        ))}
      </div>

      {/* AI 맞춤 추천 — 계정 현황 분석 (버튼 클릭 시) */}
      <div className="mt-6 rounded-2xl bg-[var(--w-bg-normal)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon name="sparkles" size={14} className="shrink-0 text-[var(--w-primary-normal)]" />
          <span className="font-bold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">목표 고르는 게 어렵다면?</span>
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)] ml-1">
            {suggestions ? "AI가 계정 상태를 분석해 추천했어요" : "AI가 계정 상태를 분석해 추천해 드릴게요"}
          </span>
        </div>
        {!suggestions && !suggestLoading ? (
          <div>
            <Button variant="secondary" size="md" type="button" onClick={handleSuggest}>
              AI 추천 받기
            </Button>
          </div>
        ) : (
        <div className="flex flex-row gap-2">
          {suggestLoading ? (
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-3 flex-1 p-5 rounded-2xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]"
                style={{ minHeight: 120 }}
              >
                <div className="flex flex-row items-center gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--w-line-normal)] animate-pulse" />
                  <div className="h-4 w-28 rounded bg-[var(--w-line-normal)] animate-pulse" />
                </div>
                <div className="h-3 w-full rounded bg-[var(--w-line-normal)] animate-pulse opacity-60" />
                <div className="h-3 w-3/4 rounded bg-[var(--w-line-normal)] animate-pulse opacity-40" />
              </div>
            ))
          ) : suggestions ? (
            suggestions.map((s) => {
              const obj = OBJECTIVES_PHASE1.find((o) => o.id === s.objectiveId);
              return (
                <button
                  key={s.objectiveId}
                  type="button"
                  onClick={() => {
                    creative.dispatch({ type: "SET_OUTCOME", outcome: s.objectiveId });
                    onNext();
                  }}
                  className="flex flex-col gap-3 flex-1 p-5 rounded-2xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-left cursor-pointer transition-[box-shadow,border-color] duration-[160ms] hover:shadow-[0_4px_10px_rgba(0,0,0,0.08),0_10px_24px_rgba(0,0,0,0.1)] hover:border-[var(--w-accent-violet)]"
                >
                  <div className="flex flex-row items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,102,255,0.08)", color: "var(--w-primary-press)" }}>
                      <Icon name={obj?.iconName ?? "target"} size={20} strokeWidth={1.7} />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="font-bold text-[13px] leading-[1.35] tracking-[-0.006em] text-[var(--w-fg-strong)] line-clamp-1">{s.title}</div>
                      <div className="font-medium text-[11px] text-[var(--w-accent-violet)]">{obj?.outcomeLabel}</div>
                    </div>
                  </div>
                  <div className="font-medium text-[12.5px] leading-[1.6] text-[var(--w-fg-neutral)] line-clamp-2">{s.reason}</div>
                </button>
              );
            })
          ) : null}
        </div>
        )}
      </div>
    </Card>
  );
}
