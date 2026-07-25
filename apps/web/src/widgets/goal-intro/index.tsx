"use client";

// PRD-create-flow-redesign §3.1 — 브리프 화면. 목표 대분류 클릭 시 세부 목표 칩이
// 카드 그리드 아래로 인라인 확장(화면 전환 없음). 브랜드 컨텍스트·강조점·제품 선택도 이 화면에 통합.

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import { Select } from "@shared/ui/Select";
import { cn } from "@shared/lib/cn";
import { OBJECTIVES_PHASE1, type ObjectiveId } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";
import { readBrandProfile, useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { useProducts } from "@shared/lib/products";
import type { CampaignSuggestion } from "@/lib/gemini-suggest-campaign";

interface Props {
  onNext: () => void;
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  productId: string | null;
  setProductId: (id: string | null) => void;
  customBrand: boolean;
  setCustomBrand: (v: boolean) => void;
}

interface GoalCardProps {
  id: ObjectiveId;
  iconName: Parameters<typeof Icon>[0]["name"];
  label: string;
  outcomeDescription: string;
  copyTone: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface CategoryCardProps {
  iconName: Parameters<typeof Icon>[0]["name"];
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}

const GOAL_CATEGORIES = [
  {
    id: "visit",
    label: "방문 늘리기",
    desc: "웹사이트·페이지로 사람들을 보내 행동을 이끌어요",
    iconName: "globe" as const,
    goalIds: ["traffic", "traffic_page_visit"] as ObjectiveId[],
  },
  {
    id: "engage",
    label: "참여 늘리기",
    desc: "좋아요·댓글·메시지로 고객과 가까워져요",
    iconName: "heart" as const,
    goalIds: ["engagement", "engagement_page_likes", "engagement_messages"] as ObjectiveId[],
  },
  {
    id: "awareness",
    label: "브랜드 알리기",
    desc: "더 많은 사람에게 노출해 브랜드를 각인시켜요",
    iconName: "megaphone" as const,
    goalIds: ["awareness"] as ObjectiveId[],
  },
  {
    id: "action",
    label: "문의·홍보하기",
    desc: "전화 문의를 받거나 게시물을 더 퍼뜨려요",
    iconName: "phone" as const,
    goalIds: ["leads_call", "boost_post"] as ObjectiveId[],
  },
] as const;

function CategoryCard({ iconName, label, desc, active, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-row items-center gap-4 p-5 rounded-[18px] border-[1.5px] bg-[var(--w-bg-normal)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-[160ms] w-full hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(0,0,0,0.06),0_10px_24px_rgba(0,0,0,0.08)]",
        active ? "border-[var(--w-accent-violet)] bg-[rgba(101,65,242,0.025)]" : "border-transparent hover:border-[var(--w-line-normal)]"
      )}
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: active ? "var(--w-primary-soft)" : "rgba(0, 102, 255, 0.06)",
          color: active ? "var(--w-accent-violet)" : "var(--w-primary-press)",
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

function GoalCard({ id, iconName, label, outcomeDescription, copyTone, active, disabled, onClick }: GoalCardProps) {
  return (
    <button
      key={id}
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "곧 열려요 — Pixel/Lead Form/App SDK 등 추가 인프라가 필요한 광고 목표예요" : copyTone}
      className={cn(
        "relative flex flex-col gap-3 p-4 rounded-2xl border-[1.5px] border-transparent bg-[var(--w-bg-normal)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-[160ms] w-full items-start",
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
          top: 10,
          right: 12,
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
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: active ? "var(--w-primary-soft)" : "rgba(0, 102, 255, 0.06)",
          color: active ? "var(--w-accent-violet)" : "var(--w-primary-press)",
          display: "grid",
          placeItems: "center",
          transition: "background 120ms ease, color 120ms ease",
        }}
      >
        <Icon name={iconName} size={18} strokeWidth={1.7} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{
          font: "700 14px/1.3 var(--w-font-sans)",
          color: active ? "var(--w-accent-violet)" : "var(--w-fg-strong)",
        }}>
          {label}
        </span>
        <span style={{
          font: "500 12px/1.4 var(--w-font-sans)",
          color: "var(--w-fg-neutral)",
        }}>
          {outcomeDescription}
        </span>
      </div>
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

export default function GoalIntro(p: Props) {
  const creative = useCreativeDraft();
  const outcome = creative.state.outcome;
  const { data: session, status } = useSession();
  const browseMode = !!session?.browseMode;
  const { profile: bp, profiles, activeId } = useBrandProfileStorage(browseMode);
  const { products } = useProducts(activeId ?? "");
  const hasBrandProfile = !!bp.brandDescription;
  const isProfileMode = hasBrandProfile && !p.customBrand;

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // 프로필이 아예 없으면 직접입력 영역을 기본 노출.
  useEffect(() => {
    if (status !== "loading" && !browseMode && !hasBrandProfile) p.setCustomBrand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, browseMode, hasBrandProfile]);

  const handleSuggest = () => {
    const brandProfile = readBrandProfile();
    const recentObjectives = readRecentObjectives();
    const sig = suggestSignature(brandProfile, recentObjectives);

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
        brandDescription: brandProfile.brandDescription,
        brandVoice: brandProfile.brandVoice,
        tone: brandProfile.tone,
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
      return;
    }
    setOpenCategory(categoryId);
  };

  const handleSelectSubGoal = (id: ObjectiveId) => {
    creative.dispatch({ type: "SET_OUTCOME", outcome: id });
    setOpenCategory(null);
  };

  const profileName =
    profiles.find((pr) => pr.id === activeId)?.name ??
    profiles.find((pr) => pr.isDefault)?.name ??
    profiles[0]?.name;

  const openCat = openCategory ? GOAL_CATEGORIES.find((c) => c.id === openCategory) : null;
  const subGoals = openCat
    ? OBJECTIVES_PHASE1.filter((o) => (openCat.goalIds as readonly string[]).includes(o.id))
    : [];

  return (
    <Card variant="lg" style={{ padding: 32 }}>
      {/* 브랜드 컨텍스트 */}
      <div style={{ marginBottom: 24 }}>
        <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ display: "block", marginBottom: 10 }}>
          어떤 브랜드·제품을 홍보하나요?
        </label>

        {isProfileMode ? (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
            <div className="flex flex-col gap-1.5 min-w-0" style={{ flex: 1 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-[3px] rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] font-semibold text-[12px] leading-none shrink-0">
                  {profileName}
                </span>
                <button
                  type="button"
                  onClick={() => p.setCustomBrand(true)}
                  className="font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] cursor-pointer"
                >
                  직접입력
                </button>
              </div>
              <p className="m-0 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-normal)] line-clamp-3">{bp.brandDescription}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[80px]"
              value={p.brand}
              onChange={(e) => p.setBrand(e.target.value)}
              placeholder="예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'."
            />
            {hasBrandProfile && (
              <button
                type="button"
                onClick={() => p.setCustomBrand(false)}
                className="self-start font-medium text-[13px] text-[var(--w-fg-neutral)] hover:text-[var(--w-primary-normal)] cursor-pointer"
              >
                ← 브랜드 프로필 다시 사용
              </button>
            )}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-strong)]">
                누구에게 보여줄 광고인가요?
              </label>
              <textarea
                className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[80px]"
                value={p.target}
                onChange={(e) => p.setTarget(e.target.value)}
                placeholder="타겟의 직업·나이·관심사·라이프스타일을 적어주세요"
              />
            </div>
          </div>
        )}
      </div>

      {/* 광고 목표 */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">어떤 광고를 만들까요?</h2>
        <Chip variant="neutral">필수</Chip>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {GOAL_CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.id}
            iconName={cat.iconName}
            label={cat.label}
            desc={cat.desc}
            active={cat.goalIds.includes(outcome as ObjectiveId)}
            onClick={() => handleCategoryClick(cat.id)}
          />
        ))}
      </div>

      <Dialog open={!!openCat} onOpenChange={(open) => !open && setOpenCategory(null)}>
        <DialogContent style={{ width: 560, padding: 28 }}>
          <DialogTitle className="m-0 font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ marginBottom: 16 }}>
            {openCat?.label}
          </DialogTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${subGoals.length}, 1fr)`,
              gap: 10,
            }}
          >
            {subGoals.map((o) => (
              <GoalCard
                key={o.id}
                id={o.id}
                iconName={o.iconName}
                label={o.outcomeLabel}
                outcomeDescription={o.outcomeDescription}
                copyTone={o.copyTone}
                active={outcome === o.id}
                onClick={() => handleSelectSubGoal(o.id)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
                    setOpenCategory(null);
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
                  <div className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] line-clamp-2">{s.reason}</div>
                </button>
              );
            })
          ) : null}
        </div>
        )}
      </div>

      {/* 이번 광고에서 강조할 점 + 제품 선택 */}
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">
            이번 광고에서 강조할 점{" "}
            <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">(선택)</span>
          </label>
          <input
            className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
            value={creative.state.outcomeHint ?? ""}
            onChange={(e) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: e.target.value })}
            placeholder="예) 5월 신상 한정 할인 강조"
          />
        </div>

        {isProfileMode && products.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
              제품 선택 <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">(선택)</span>
            </label>
            <Select
              value={p.productId ?? ""}
              onChange={(v) => p.setProductId(v || null)}
              placeholder="제품 선택 (선택 안 하면 브랜드 전체 광고)"
              options={products.map((pr) => ({ value: pr.id, label: pr.name }))}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
        <Button
          variant="primary"
          size="lg"
          type="button"
          onClick={p.onNext}
          disabled={!outcome}
          title={!outcome ? "광고 목표를 먼저 골라주세요" : undefined}
          style={{ minWidth: 240 }}
        >
          소재 만들기 시작
        </Button>
      </div>
    </Card>
  );
}
