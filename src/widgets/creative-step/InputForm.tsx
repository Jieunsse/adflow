"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Select } from "@shared/ui/Select";
import { cn } from "@shared/lib/cn";
import { OBJECTIVES_PHASE1, TONES, COPY_HOOKS, findHook, type CopyHook } from "@entities/creative/options";
import SelectedGoalCard from "@entities/creative/ui/SelectedGoalCard";
import { useCreativeDraft } from "@entities/creative/model";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { usePersonasStorage } from "@features/brand-profile/model/usePersonasStorage";
import PersonaQuickCreateModal from "@features/brand-profile/ui/PersonaQuickCreateModal";
import BrandProfilePickerModal from "@features/brand-profile/ui/BrandProfilePickerModal";
import { useProducts } from "@shared/lib/products";

interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  productId: string | null;
  setProductId: (id: string | null) => void;
  tone: string;
  setTone: (id: string) => void;
  onChangeOutcome: () => void;
  generating: boolean;
  onGenerate: () => void;
  selectedCopyRefIds: string[];
  setSelectedCopyRefIds: (ids: string[]) => void;
  hooks: CopyHook[];
  setHooks: (hooks: CopyHook[]) => void;
}

export default function InputForm(p: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const browseMode = !!session?.browseMode;
  const creative = useCreativeDraft();
  const { profile: bp, profiles, activeId, setActiveId } = useBrandProfileStorage(browseMode);
  const copyRefs = bp.copyReferences ?? [];
  const bpBrand = bp.brandDescription ?? "";
  const bpTone = bp.tone;

  const { personas: allPersonas, savePersona } = usePersonasStorage();
  const personas = activeId
    ? allPersonas.filter((pe) => pe.brandProfileId === activeId)
    : allPersonas;

  const { products } = useProducts(activeId ?? "");
  const selectedProduct = products.find((pr) => pr.id === p.productId) ?? null;
  const selectedPersona = personas.find((pe) => pe.id === p.personaId) ?? null;
  const hasBrandProfile = !!bpBrand;

  const [inputMode, setInputMode] = useState<"profile" | "custom">(() => {
    try {
      return (sessionStorage.getItem("adflow_input_mode") as "profile" | "custom") ?? (hasBrandProfile ? "profile" : "custom");
    } catch {
      return hasBrandProfile ? "profile" : "custom";
    }
  });
  const isProfileMode = inputMode === "profile" && hasBrandProfile;

  const [contextExpanded, setContextExpanded] = useState(!isProfileMode);
  const [hooksExpanded, setHooksExpanded] = useState(false);
  const [showNoBrandProfileModal, setShowNoBrandProfileModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);

  useEffect(() => {
    if (status === "loading" || browseMode || hasBrandProfile) return;
    let dismissed: string | null = null;
    try { dismissed = sessionStorage.getItem("adflow_brand_modal_dismissed"); } catch {}
    if (!dismissed) setShowNoBrandProfileModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, browseMode]);

  const switchInputMode = (mode: "profile" | "custom") => {
    setInputMode(mode);
    try { sessionStorage.setItem("adflow_input_mode", mode); } catch {}
    if (mode === "custom") {
      if (!p.brand.trim()) p.setBrand(bpBrand);
    }
  };

  const prevActiveId = useRef<string | null>(activeId ?? null);
  useEffect(() => {
    const switched = prevActiveId.current !== (activeId ?? null);
    prevActiveId.current = activeId ?? null;
    if (switched && bpBrand) {
      setInputMode("profile");
      try { sessionStorage.setItem("adflow_input_mode", "profile"); } catch {}
      setContextExpanded(false);
    }
  }, [activeId, bpBrand]);

  const prevOutcome = creative.state.previousOutcome;
  const hasCopy = creative.state.headlineCandidates !== null;
  const showStaleBanner = prevOutcome !== null && hasCopy;
  const prevLabel = prevOutcome ? OBJECTIVES_PHASE1.find((o) => o.id === prevOutcome)?.label ?? prevOutcome : "";

  const brandValue = isProfileMode ? bpBrand : p.brand;
  // 프로필 모드 + 페르소나 셀렉터가 있으면 페르소나가 오디언스 입력 — target 텍스트(데모 시드)에 의존하지 않음.
  const personaRequired = isProfileMode && personas.length > 0;
  const generateDisabled = p.generating || !brandValue.trim() || (!personaRequired && !p.target.trim());

  const handleGenerate = () => {
    if (personaRequired && !p.personaId) {
      setShowPersonaModal(true);
      return;
    }
    p.onGenerate();
  };

  const profileName =
    profiles.find((pr) => pr.id === activeId)?.name ??
    profiles.find((pr) => pr.isDefault)?.name ??
    profiles[0]?.name;

  return (
    <>
      <Card variant="lg">
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 4 }}>
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">소재 정보 입력</h2>
          <Badge kind="neutral">필수</Badge>
        </div>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1" style={{ marginBottom: 16 }}>
          선택한 광고 목표에 맞춰 AI가 카피를 만들어요.
        </p>

        {/* 브랜드 컨텍스트 섹션 (접힘/펼침) */}
        <div className="rounded-xl border border-[var(--w-line-normal)] overflow-hidden" style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setContextExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--w-bg-elevated)] hover:bg-[var(--w-bg-alternative)] transition-colors duration-[120ms] cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-[13px] text-[var(--w-fg-strong)] shrink-0">브랜드 컨텍스트</span>
              {isProfileMode && profileName && (
                <span className="inline-flex items-center px-2.5 py-[3px] rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] font-semibold text-[11.5px] leading-none shrink-0">
                  {profileName}
                </span>
              )}
              {isProfileMode && selectedProduct && (
                <span className="inline-flex items-center px-2.5 py-[3px] rounded-full border border-[var(--w-line-normal)] text-[var(--w-fg-strong)] font-medium text-[11.5px] leading-none shrink-0">
                  {selectedProduct.name}
                </span>
              )}
              {isProfileMode && selectedPersona && (
                <span className="inline-flex items-center px-2.5 py-[3px] rounded-full border border-[var(--w-line-normal)] text-[var(--w-fg-strong)] font-medium text-[11.5px] leading-none shrink-0">
                  {selectedPersona.name}
                </span>
              )}
              {isProfileMode && !selectedProduct && !selectedPersona && (
                <span className="font-medium text-[11.5px] text-[var(--w-fg-alternative)]">
                  제품·페르소나 선택 시 카피 품질이 올라가요
                </span>
              )}
              {!isProfileMode && (
                <span className="font-medium text-[11.5px] text-[var(--w-fg-alternative)]">직접 입력</span>
              )}
            </div>
            <Icon
              name="chev-down"
              size={16}
              className={cn("text-[var(--w-fg-neutral)] shrink-0 ml-2 transition-transform duration-[160ms]", contextExpanded && "rotate-180")}
            />
          </button>

          {contextExpanded && (
            <div className="flex flex-col gap-4 px-4 py-4 border-t border-[var(--w-line-normal)]">
              {hasBrandProfile && (
                <div className="flex items-center rounded-xl border border-[var(--w-line-normal)] overflow-hidden" style={{ height: 36 }}>
                  <button
                    type="button"
                    onClick={() => switchInputMode("profile")}
                    className={cn(
                      "flex-1 font-semibold text-[13px] leading-none h-full transition-colors duration-[120ms] border-none cursor-pointer",
                      isProfileMode
                        ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)]"
                        : "bg-transparent text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
                    )}
                  >
                    브랜드 프로필
                  </button>
                  <button
                    type="button"
                    onClick={() => switchInputMode("custom")}
                    className={cn(
                      "flex-1 font-semibold text-[13px] leading-none h-full transition-colors duration-[120ms] border-none cursor-pointer",
                      !isProfileMode
                        ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)]"
                        : "bg-transparent text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
                    )}
                    style={{ borderLeft: "1px solid var(--w-line-normal)" }}
                  >
                    직접 입력
                  </button>
                </div>
              )}

              {isProfileMode && profiles.length > 1 && (
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
                    브랜드 프로필
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowProfilePicker(true)}
                    className="flex items-center justify-between w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] hover:border-[var(--w-primary-normal)] transition-colors duration-[120ms] cursor-pointer"
                  >
                    <span className="font-medium text-[14px] text-[var(--w-fg-strong)]">{profileName}</span>
                    <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">변경</span>
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
                  어떤 브랜드·제품을 홍보하나요?
                </label>
                <textarea
                  className={cn(
                    "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[80px]",
                    isProfileMode && "bg-[var(--w-bg-alternative)] border-[var(--w-line-alternative)] text-[var(--w-fg-normal)]"
                  )}
                  value={brandValue}
                  onChange={(e) => { if (!isProfileMode) p.setBrand(e.target.value); }}
                  readOnly={isProfileMode}
                  placeholder="예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'."
                />
                {isProfileMode && products.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Select
                      value={p.productId ?? ""}
                      onChange={(v) => p.setProductId(v || null)}
                      placeholder="제품 선택 (선택 안 하면 브랜드 전체 광고)"
                      options={products.map((pr) => ({ value: pr.id, label: pr.name }))}
                    />
                    {selectedProduct && (
                      <div className="px-[14px] py-3 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
                        <span className="font-semibold text-[14px] text-[var(--w-fg-strong)]">{selectedProduct.name}</span>
                        <p className="m-0 mt-1 font-medium text-[13px] text-[var(--w-fg-neutral)]">{selectedProduct.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
                  누구에게 보여줄 광고인가요?
                </label>
                {personas.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={p.personaId ?? ""}
                        onChange={(v) => p.setPersonaId(v || null)}
                        placeholder="페르소나 선택"
                        options={personas.map((pe) => ({ value: pe.id, label: pe.name }))}
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-[10px] py-2 rounded-xl border border-dashed border-[var(--w-line-normal)] font-medium text-[12px] text-[var(--w-fg-neutral)] cursor-pointer hover:border-[var(--w-primary-normal)] hover:text-[var(--w-primary-normal)] transition-colors duration-[120ms] whitespace-nowrap"
                      onClick={() => setShowQuickCreate(true)}
                    >
                      새 페르소나
                    </button>
                  </div>
                ) : (
                  <textarea
                    className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[80px]"
                    value={p.target}
                    onChange={(e) => p.setTarget(e.target.value)}
                    placeholder="타겟의 직업·나이·관심사·라이프스타일을 적어주세요"
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
                  광고 느낌
                </label>
                {isProfileMode && bpTone ? (
                  <span className="inline-flex items-center px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)]">
                    {bpTone}
                  </span>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 flex-wrap">
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms] hover:border-[var(--w-fg-normal)]"
                          onClick={() => p.setTone(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <input
                      className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
                      value={TONES.find((t) => t.id === p.tone)?.label ?? p.tone}
                      onChange={(e) => p.setTone(e.target.value)}
                      placeholder="예) 유머러스하고 가볍게, 진지하고 설득력 있게 …"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 이번 광고 */}
        <SelectedGoalCard onChange={p.onChangeOutcome} />

        {showStaleBanner && (
          <div
            className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] bg-[rgba(255,146,0,0.10)] border border-[rgba(255,146,0,0.24)]"
            style={{ marginTop: 16 }}
          >
            <Icon name="info" size={16} className="text-[var(--w-status-cautionary)] mt-0.5 shrink-0" />
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                이 카피는 이전 목표 &lsquo;{prevLabel}&rsquo; 기준이에요
              </div>
              <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "4px 0 0" }}>
                새 목표에 맞게 다시 만드는 걸 추천해요.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Button variant="primary" size="sm" type="button" onClick={handleGenerate} disabled={generateDisabled}>
                  <Icon name="sparkles" size={12} /> 다시 생성
                </Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => creative.dispatch({ type: "CLEAR_PREVIOUS_OUTCOME" })}>
                  그대로 둘게요
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4" style={{ marginTop: 20 }}>
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">
              강조하고 싶은 포인트{" "}
              <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">(선택)</span>
            </label>
            <input
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
              value={creative.state.outcomeHint ?? ""}
              onChange={(e) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: e.target.value })}
              placeholder="예) 5월 신상 한정 할인 강조"
            />
          </div>

          {isProfileMode && copyRefs.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">
                참조할 문체 고르기{" "}
                <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">(선택)</span>
              </label>
              <p className="m-0 font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
                선택한 문체를 참고해서 AI가 고객 언어를 반영해요
              </p>
              <div className="flex flex-wrap gap-2">
                {copyRefs.map((ref) => {
                  const checked = p.selectedCopyRefIds.includes(ref.id);
                  const chipLabel = ref.text.length > 22 ? ref.text.slice(0, 22) + "…" : ref.text;
                  return (
                    <button
                      key={ref.id}
                      type="button"
                      title={ref.text}
                      onClick={() => {
                        const next = checked
                          ? p.selectedCopyRefIds.filter((id) => id !== ref.id)
                          : [...p.selectedCopyRefIds, ref.id];
                        p.setSelectedCopyRefIds(next);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium text-[12.5px] leading-none cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                        checked
                          ? "border-[var(--w-primary-normal)] bg-[rgba(0,102,255,0.08)] text-[var(--w-primary-press)]"
                          : "border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-normal)]"
                      )}
                    >
                      {ref.source === "ig" && <Icon name="instagram" size={12} className="shrink-0" />}
                      {chipLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--w-line-normal)] overflow-hidden">
            <button
              type="button"
              onClick={() => setHooksExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--w-bg-elevated)] hover:bg-[var(--w-bg-alternative)] transition-colors duration-[120ms] cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-semibold text-[13px] text-[var(--w-fg-strong)] shrink-0">마케팅 전략</span>
                <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] font-semibold text-[11px] leading-none shrink-0">
                  <Icon name="sparkles" size={10} /> AI 추천
                </span>
                {!hooksExpanded && p.hooks.map((h, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-[3px] rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] font-semibold text-[11.5px] leading-none shrink-0">
                    {findHook(h).ko}
                  </span>
                ))}
                {!hooksExpanded && (
                  <span className="font-medium text-[11.5px] text-[var(--w-fg-alternative)] shrink-0">
                    {p.hooks.length === 0 ? "칩을 골라 채워요" : "직접 바꿀 수 있어요"}
                  </span>
                )}
              </div>
              <Icon
                name="chev-down"
                size={16}
                className={cn("text-[var(--w-fg-neutral)] shrink-0 ml-2 transition-transform duration-[160ms]", hooksExpanded && "rotate-180")}
              />
            </button>
            {hooksExpanded && (
              <div className="flex flex-col gap-4 px-4 py-4 border-t border-[var(--w-line-normal)]">
                <p className="m-0 font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
                  본문 3개는 각각 다른 마케팅 전략을 활용해요.<br />
                  칩을 고르면 <span className="text-[var(--w-fg-strong)]">VER 01</span> 부터 차례로 채워져요.<br />
                  비운 칸은 AI가 골라요.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {COPY_HOOKS.map((hk) => {
                    const active = p.hooks.includes(hk.id);
                    const full = p.hooks.length >= 3;
                    const disabled = !active && full;
                    return (
                      <button
                        key={hk.id}
                        type="button"
                        title={hk.uiDesc}
                        disabled={disabled}
                        onClick={() => {
                          if (active) p.setHooks(p.hooks.filter((h) => h !== hk.id));
                          else if (!full) p.setHooks([...p.hooks, hk.id]);
                        }}
                        className={cn(
                          "inline-flex items-center px-3 py-1.5 rounded-full border font-medium text-[12.5px] leading-none transition-[background,border-color,color,opacity] duration-[120ms]",
                          active
                            ? "border-[var(--w-primary-normal)] bg-[rgba(0,102,255,0.08)] text-[var(--w-primary-press)] font-semibold cursor-pointer"
                            : disabled
                            ? "border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] opacity-50 cursor-not-allowed"
                            : "border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-normal)] cursor-pointer"
                        )}
                      >
                        {hk.ko}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const id = p.hooks[i];
                    const def = id ? findHook(id) : null;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 aspect-square flex flex-col items-start gap-5 p-4 rounded-xl border text-left transition-[border-color,background] duration-[120ms]",
                          def
                            ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)]"
                            : "border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]"
                        )}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                              def ? "bg-[var(--w-primary-normal)] text-white" : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]"
                            )}
                          >
                            {def ? <Icon name={def.icon} size={18} /> : <span className="font-bold text-[15px]">{i + 1}</span>}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-[600] text-[11px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">VER 0{i + 1}</span>
                            <span className={cn("font-bold text-[18px] leading-[1.25]", def ? "text-[var(--w-fg-strong)]" : "text-[var(--w-fg-neutral)]")}>
                              {def ? def.ko : "선택하기"}
                            </span>
                          </div>
                        </div>
                        <span className="mt-auto font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] whitespace-pre-line">
                          {def ? def.uiDesc : "칩을 골라\n채워 주세요"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
            <Icon name="sparkles" size={14} style={{ color: "var(--w-accent-violet)" }} /> Gemini로 카피 생성
          </span>
          <Button variant="primary" type="button" onClick={handleGenerate} disabled={generateDisabled}>
            {p.generating ? (
              <>
                <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[14px] h-[14px]" />
                생성 중…
              </>
            ) : (
              <><Icon name="sparkles" size={14} /> AI 카피 생성하기</>
            )}
          </Button>
        </div>
      </Card>

      {/* 브랜드 프로필 미설정 모달 */}
      {showNoBrandProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-[400px] mx-4 rounded-2xl bg-[var(--w-bg-elevated)] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-7 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,102,255,0.08)", color: "var(--w-primary-press)" }}
              >
                <Icon name="sparkles" size={20} />
              </div>
              <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
                브랜드 프로필을 먼저 만들어 두세요
              </h3>
              <p className="m-0 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-neutral)]">
                브랜드 설명·타겟·고객 언어를 한 번 등록해두면
                <br />
                매번 입력 없이 바로 좋은 카피가 나와요.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                type="button"
                onClick={() => router.push("/brand-profile/new")}
                style={{ width: "100%" }}
              >
                지금 만들기
              </Button>
              <Button
                variant="ghost"
                size="lg"
                type="button"
                onClick={() => {
                  try { sessionStorage.setItem("adflow_brand_modal_dismissed", "1"); } catch {}
                  setShowNoBrandProfileModal(false);
                }}
                style={{ width: "100%" }}
              >
                이번만 직접 입력
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 페르소나 미선택 모달 — 카피 생성 차단 안내 */}
      {showPersonaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-[400px] mx-4 rounded-2xl bg-[var(--w-bg-elevated)] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-7 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,102,255,0.08)", color: "var(--w-primary-press)" }}
              >
                <Icon name="sparkles" size={20} />
              </div>
              <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
                페르소나를 먼저 선택해주세요
              </h3>
              <p className="m-0 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-neutral)]">
                누구에게 보여줄 광고인지 정해야
                <br />
                AI가 그 사람의 언어로 카피를 만들어요.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                type="button"
                onClick={() => {
                  setContextExpanded(true);
                  setShowPersonaModal(false);
                }}
                style={{ width: "100%" }}
              >
                페르소나 선택하기
              </Button>
              <Button
                variant="ghost"
                size="lg"
                type="button"
                onClick={() => {
                  setShowPersonaModal(false);
                  setShowQuickCreate(true);
                }}
                style={{ width: "100%" }}
              >
                새 페르소나 만들기
              </Button>
            </div>
          </div>
        </div>
      )}

      {showProfilePicker && (
        <BrandProfilePickerModal
          profiles={profiles}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={() => setShowProfilePicker(false)}
        />
      )}

      {showQuickCreate && (
        <PersonaQuickCreateModal
          activeBrandProfileId={activeId}
          profiles={profiles}
          onSave={(entry) => {
            savePersona(entry);
            p.setPersonaId(entry.id);
            setShowQuickCreate(false);
          }}
          onClose={() => setShowQuickCreate(false)}
        />
      )}
    </>
  );
}
