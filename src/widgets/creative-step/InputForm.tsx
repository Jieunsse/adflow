"use client";

// STEP 01 소재 정보 입력 카드 — 브랜드/타겟 입력, 톤 선택, AI 카피 생성.
// PRD §13.10 — 광고 목표 카드 grid 와 outcomeHint 는 intro 페이지로 이관. STEP 01 에선
// SelectedGoalCard 로 선택한 목표만 read-only 노출하고 "변경" 시 intro 로 복귀.

import { useState } from "react";
import Link from "next/link";
import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { OBJECTIVES_PHASE1, TONES, type ToneId } from "@entities/creative/options";
import SelectedGoalCard from "@entities/creative/ui/SelectedGoalCard";
import { useCreativeDraft } from "@entities/creative/model";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { usePersonasStorage } from "@features/brand-profile/model/usePersonasStorage";
import PersonaQuickCreateModal from "@features/brand-profile/ui/PersonaQuickCreateModal";

interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  tone: ToneId;
  setTone: (id: ToneId) => void;
  /** outcome 변경(→ intro 복귀) 콜백. SelectedGoalCard 의 "광고 목표 변경" 버튼이 호출. */
  onChangeOutcome: () => void;
  generating: boolean;
  onGenerate: () => void;
}

export default function InputForm(p: Props) {
  const creative = useCreativeDraft();
  const { profile: bp, profiles, activeId, setActiveId } = useBrandProfileStorage();
  const bpBrand = bp.brandVoice ?? "";
  const bpTone = bp.tone;

  const { personas: allPersonas, savePersona } = usePersonasStorage();
  const personas = activeId
    ? allPersonas.filter((pe) => pe.brandProfileId === activeId)
    : allPersonas;

  const selectedPersona = personas.find((pe) => pe.id === p.personaId) ?? null;

  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // PRD-objective-aware-launch §5.2 — outcome 변경 후 STEP 01 복귀 시 stale 카피 안내.
  const prevOutcome = creative.state.previousOutcome;
  const hasCopy = creative.state.headlineCandidates !== null;
  const showStaleBanner = prevOutcome !== null && hasCopy;
  const prevLabel = prevOutcome ? OBJECTIVES_PHASE1.find((o) => o.id === prevOutcome)?.label ?? prevOutcome : "";

  return (
    <>
    <Card variant="lg">
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 4 }}>
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">소재 정보 입력</h2>
        <Badge kind="neutral">필수</Badge>
      </div>
      <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0" style={{ marginBottom: 22 }}>선택한 광고 목표에 맞춰 AI가 카피를 만들어요.</p>

      <SelectedGoalCard onChange={p.onChangeOutcome} />

      {showStaleBanner && (
        <div
          className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(255,146,0,0.10)] border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]"
          style={{ marginBottom: 16 }}
        >
          <Icon name="info" size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
              이 카피는 이전 목표 &lsquo;{prevLabel}&rsquo; 기준이에요
            </div>
            <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "4px 0 0" }}>
              새 목표에 맞게 다시 만드는 걸 추천해요.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={p.onGenerate}
                disabled={p.generating || !(bpBrand || p.brand).trim() || (!p.target.trim() && !p.personaId)}
              >
                <Icon name="sparkles" size={12} /> 다시 생성
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => creative.dispatch({ type: "CLEAR_PREVIOUS_OUTCOME" })}
              >
                그대로 둘게요
              </Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">강조하고 싶은 포인트 (선택)</label>
          <input
            className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
            value={creative.state.outcomeHint ?? ""}
            onChange={(e) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: e.target.value })}
            placeholder="예) 5월 신상 한정 할인 강조"
          />
        </div>
        <div className="flex flex-col gap-2">
          {profiles.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">브랜드 프로필</span>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "inline-flex items-center px-[10px] py-1 rounded-full border font-medium text-[12px] leading-none cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                    (activeId === p.id || (!activeId && p.isDefault))
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                      : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-strong)]"
                  )}
                  onClick={() => setActiveId(p.id)}
                >
                  {p.name}
                </button>
              ))}
              <Link href="/brand-profile" className="ml-auto font-medium text-[12px] text-[var(--w-fg-alternative)] hover:text-[var(--w-primary-normal)] inline-flex items-center gap-0.5">
                관리 →
              </Link>
            </div>
          )}
          <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">
            어떤 브랜드·제품을 홍보하나요?
            {bpBrand && profiles.length <= 1 && (
              <Link href="/brand-profile" className="ml-auto font-medium text-[12px] text-[var(--w-primary-normal)] hover:underline inline-flex items-center gap-0.5">
                <Icon name="asterisk" size={11} /> 브랜드 프로필에서 →
              </Link>
            )}
          </label>
          <textarea
            className={cn(
              "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[88px]",
              bpBrand && "bg-[var(--w-bg-alternative)] border-[var(--w-line-alternative)] text-[var(--w-fg-normal)]"
            )}
            value={bpBrand || p.brand}
            onChange={(e) => { if (!bpBrand) p.setBrand(e.target.value); }}
            readOnly={!!bpBrand}
            placeholder={"예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'.\n대표 제품은 수분크림으로 자극 없는 성분이 강점이에요."}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">누구에게 보여줄 광고인가요?</label>
          {(personas.length > 0 || profiles.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">페르소나</span>
              {personas.length > 0 && (
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center px-[10px] py-1 rounded-full border font-medium text-[12px] leading-none cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                    !p.personaId
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                      : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-strong)]"
                  )}
                  onClick={() => p.setPersonaId(null)}
                >
                  직접 입력
                </button>
              )}
              {personas.map((pe) => (
                <button
                  key={pe.id}
                  type="button"
                  className={cn(
                    "inline-flex items-center px-[10px] py-1 rounded-full border font-medium text-[12px] leading-none cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                    p.personaId === pe.id
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                      : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-strong)]"
                  )}
                  onClick={() => p.setPersonaId(pe.id)}
                >
                  {pe.name}
                </button>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 px-[10px] py-1 rounded-full border border-dashed border-[var(--w-line-normal)] font-medium text-[12px] leading-none text-[var(--w-fg-neutral)] cursor-pointer hover:border-[var(--w-primary-normal)] hover:text-[var(--w-primary-normal)] transition-colors duration-[120ms]"
                onClick={() => setShowQuickCreate(true)}
              >
                <Icon name="plus" size={11} /> 새 페르소나
              </button>
              <Link href="/brand-profile" className="ml-auto font-medium text-[12px] text-[var(--w-fg-alternative)] hover:text-[var(--w-primary-normal)] inline-flex items-center gap-0.5">
                관리 →
              </Link>
            </div>
          )}
          {!selectedPersona && (
            <textarea
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[88px]"
              value={p.target}
              onChange={(e) => p.setTarget(e.target.value)}
              placeholder="타겟의 직업·나이·관심사·라이프스타일을 적어주세요"
            />
          )}
          {selectedPersona && (
            <div className="px-[14px] py-3 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)] text-[14px] leading-[1.5] text-[var(--w-fg-normal)]">
              <span className="font-semibold text-[var(--w-fg-strong)]">{selectedPersona.name}</span>
              {selectedPersona.customerDescription && (
                <p className="m-0 mt-1 font-medium text-[13px] text-[var(--w-fg-neutral)]">{selectedPersona.customerDescription}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">
            광고 느낌
            {bpTone && (
              <Link href="/brand-profile" className="ml-auto font-medium text-[12px] text-[var(--w-primary-normal)] hover:underline inline-flex items-center gap-0.5">
                <Icon name="asterisk" size={11} /> 브랜드 프로필에서 →
              </Link>
            )}
          </label>
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => {
              const active = (bpTone || p.tone) === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!!bpTone}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] transition-[background,border-color,color] duration-[120ms]",
                    active && "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]",
                    bpTone ? "cursor-default opacity-70" : "cursor-pointer"
                  )}
                  onClick={() => { if (!bpTone) p.setTone(t.id); }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
            <Icon name="sparkles" size={14} style={{ color: "var(--w-accent-violet)" }} /> Gemini로 카피 생성
          </span>
          <Button
            variant="primary"
            type="button"
            onClick={p.onGenerate}
            disabled={p.generating || !(bpBrand || p.brand).trim() || (!p.target.trim() && !p.personaId)}
          >
            {p.generating ? (
              <><div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[14px] h-[14px]" /> 생성 중…</>
            ) : (
              <><Icon name="sparkles" size={14} /> AI 카피 생성하기</>
            )}
          </Button>
        </div>
      </div>
    </Card>

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
