"use client";

// PRD-create-flow-redesign §3.2 — 스튜디오 ③ 다시 만들기(레버) 섹션. 브랜드·타겟·제품·강조점은
// 브리프(GoalIntro)로 승격돼 여기서 제거. 남는 레버(페르소나·톤·문체·마케팅 전략 훅)만 컴팩트하게.

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
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
import { readLedger } from "@entities/ab-test/tournament/ledger";
import { ledgerLadder, type LedgerContext } from "@entities/ab-test/tournament/hypothesis";
import { ledgerBiasedHooks } from "@entities/ab-test/tournament/ledger-bias";
import type { Hypothesis } from "@entities/ab-test/tournament/engine";

interface Props {
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  productId: string | null;
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
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const creative = useCreativeDraft();
  const { profile: bp, profiles, activeId } = useBrandProfileStorage(browseMode);
  const copyRefs = bp.copyReferences ?? [];
  const bpTone = bp.tone;

  const { personas: allPersonas, savePersona } = usePersonasStorage();
  const personas = activeId
    ? allPersonas.filter((pe) => pe.brandProfileId === activeId)
    : allPersonas;
  const selectedPersona = personas.find((pe) => pe.id === p.personaId) ?? null;

  // ADR-050 — A/B 토너먼트가 검증한 학습(Hypothesis Ledger)으로 추천 카피 훅을 편향한다.
  const outcome = creative.state.outcome;
  const [ledgerEntries, setLedgerEntries] = useState<Hypothesis[]>([]);

  useEffect(() => {
    if (!activeId) { setLedgerEntries([]); return; }
    if (browseMode) {
      setLedgerEntries(readLedger(activeId));
      return;
    }
    fetch(`/api/ledger?brandProfileId=${encodeURIComponent(activeId)}`)
      .then((r) => r.ok ? r.json() : { ledger: [] })
      .then((d: { ledger?: Hypothesis[] }) => setLedgerEntries(d.ledger ?? []))
      .catch(() => setLedgerEntries([]));
  }, [activeId, browseMode]);

  const biased = useMemo(() => {
    if (!outcome) return null;
    const ctx: LedgerContext = { productId: p.productId ?? "", objective: outcome };
    return ledgerBiasedHooks(outcome, ledgerLadder(ledgerEntries, ctx));
  }, [outcome, p.productId, ledgerEntries]);

  const hooksTouched = useRef(false);
  useEffect(() => {
    // outcome·제품 바뀌면 편향 기본값을 추천 훅에 적용(소프트). 유저가 칩을 만진 뒤엔 덮어쓰지 않음.
    hooksTouched.current = false;
    if (outcome) p.setHooks(biased ? biased.hooks : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, p.productId, activeId]);

  // 학습 탭 CTA(`/create?hook=`) 프리셀렉트 — page.tsx 가 sessionStorage 로 전달. 편향 기본값 effect
  // 뒤에 선언해 마운트 시 덮어쓰이지 않게 하고, 소비 후 제거해 1회성으로 유지.
  useEffect(() => {
    let preselect: string | null = null;
    try { preselect = sessionStorage.getItem("adflow_hook_preselect"); } catch { /* 무시 */ }
    if (!preselect) return;
    try { sessionStorage.removeItem("adflow_hook_preselect"); } catch { /* 무시 */ }
    if (COPY_HOOKS.some((h) => h.id === preselect)) {
      hooksTouched.current = true;
      p.setHooks([preselect as CopyHook]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 디테일 칩 팔레트 순서 — 입증 승격(상단)·중립 유지·반증 강등(하단).
  const paletteOrder = useMemo(() => {
    if (!biased) return COPY_HOOKS;
    const rank = (id: CopyHook) => {
      const v = biased.bias[id]?.verdict;
      return v === "confirmed" ? 0 : v === "refuted" ? 2 : 1;
    };
    return [...COPY_HOOKS].sort((a, b) => rank(a.id) - rank(b.id));
  }, [biased]);

  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const prevOutcome = creative.state.previousOutcome;
  const hasCopy = creative.state.headlineCandidates !== null;
  const showStaleBanner = prevOutcome !== null && hasCopy;
  const prevLabel = prevOutcome ? OBJECTIVES_PHASE1.find((o) => o.id === prevOutcome)?.label ?? prevOutcome : "";

  return (
    <>
      <Card variant="lg">
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]" style={{ marginBottom: 16 }}>
          ③ 다시 만들기
        </h2>

        <SelectedGoalCard onChange={p.onChangeOutcome} />

        {showStaleBanner && (
          <div
            className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] bg-[rgba(255,146,0,0.10)] border border-[rgba(255,146,0,0.24)]"
            style={{ marginBottom: 16 }}
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
                <Button variant="primary" size="sm" type="button" onClick={p.onGenerate} disabled={p.generating}>
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
            <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
              누구에게 보여줄 광고인가요? <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">(선택)</span>
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
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 px-[14px] py-3 rounded-xl border border-dashed border-[var(--w-line-normal)] font-medium text-[13px] text-[var(--w-fg-neutral)] cursor-pointer hover:border-[var(--w-primary-normal)] hover:text-[var(--w-primary-normal)] transition-colors duration-[120ms]"
                onClick={() => setShowQuickCreate(true)}
              >
                + 페르소나 추가
              </button>
            )}
            {selectedPersona && (
              <span className="inline-flex items-center px-2.5 py-[3px] rounded-full border border-[var(--w-line-normal)] text-[var(--w-fg-strong)] font-medium text-[12px] leading-none self-start">
                {selectedPersona.name}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">
              광고 느낌
            </label>
            {bpTone ? (
              <span className="inline-flex items-center px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] self-start">
                {bpTone}
              </span>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border font-medium text-[13px] leading-none cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                      p.tone === t.id
                        ? "border-[var(--w-primary-normal)] bg-[rgba(0,102,255,0.08)] text-[var(--w-primary-press)] font-semibold"
                        : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-normal)]"
                    )}
                    onClick={() => p.setTone(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {copyRefs.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">
                참조할 문체 고르기{" "}
                <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">(선택)</span>
              </label>
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
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium text-[13px] leading-none cursor-pointer transition-[background,border-color,color] duration-[120ms]",
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

          {/* 마케팅 전략 (카피 훅) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[14px] text-[var(--w-fg-strong)]">마케팅 전략</span>
              <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] font-semibold text-[11px] leading-none shrink-0">
                <Icon name="sparkles" size={10} /> AI 추천
              </span>
            </div>
            <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              본문 3개는 각각 다른 마케팅 전략을 활용해요.<br />
              칩을 고르면 <span className="text-[var(--w-fg-strong)]">VER 01</span> 부터 차례로 채워져요. 비운 칸은 AI가 골라요.
            </p>

            {biased && Object.keys(biased.bias).length > 0 && (
              <div className="flex items-start gap-1.5 px-3 py-2.5 rounded-[10px] bg-[var(--w-status-positive-soft)] border border-[var(--w-status-positive-line)]">
                <Icon name="sparkles" size={13} className="text-[var(--w-status-positive)] mt-0.5 shrink-0" />
                <span className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-normal)]">
                  이 브랜드의 A/B 학습이 추천에 반영됐어요.{" "}
                  <span className="text-[var(--w-green-700)] font-semibold">입증</span>된 훅은 위로,{" "}
                  <span className="text-[var(--w-status-negative)] font-semibold">반증</span>된 훅은 빼서 추천해요.
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {paletteOrder.map((hk) => {
                const active = p.hooks.includes(hk.id);
                const full = p.hooks.length >= 3;
                const disabled = !active && full;
                const b = biased?.bias[hk.id];
                return (
                  <button
                    key={hk.id}
                    type="button"
                    title={hk.uiDesc}
                    disabled={disabled}
                    onClick={() => {
                      hooksTouched.current = true;
                      if (active) p.setHooks(p.hooks.filter((h) => h !== hk.id));
                      else if (!full) p.setHooks([...p.hooks, hk.id]);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full border font-medium text-[13px] leading-none transition-[background,border-color,color,opacity] duration-[120ms]",
                      active
                        ? "border-[var(--w-primary-normal)] bg-[rgba(0,102,255,0.08)] text-[var(--w-primary-press)] font-semibold cursor-pointer"
                        : disabled
                        ? "border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] opacity-50 cursor-not-allowed"
                        : "border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:border-[var(--w-fg-normal)] cursor-pointer",
                      b?.verdict === "refuted" && !active && "opacity-55"
                    )}
                  >
                    {hk.ko}
                    {b?.verdict === "confirmed" && (
                      <span className="inline-flex items-center px-1 py-[1px] rounded-full bg-[var(--w-status-positive-soft)] text-[var(--w-green-700)] font-bold text-[10px] leading-none">
                        +{b.effectSize}%
                      </span>
                    )}
                    {b?.verdict === "refuted" && (
                      <span className="inline-flex items-center px-1 py-[1px] rounded-full bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)] font-bold text-[10px] leading-none">
                        반증
                      </span>
                    )}
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
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <Button variant="primary" type="button" onClick={p.onGenerate} disabled={p.generating}>
            {p.generating ? (
              <>
                <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[14px] h-[14px]" />
                생성 중…
              </>
            ) : (
              <><Icon name="sparkles" size={14} /> 이 조건으로 다시 생성</>
            )}
          </Button>
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
