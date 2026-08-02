"use client";

// 시안 1d — STEP 01 브리프. 채울 것(제품·목표·타겟·근거 자료)을 한 열로 쌓고 맨 아래에 생성 CTA.
// 시안의 우측 "이렇게 만들어져요" 패널은 뺐다 — 회색 막대가 아무 정보도 아니었고,
// CTA 가 오른쪽 위에 고정돼 아래까지 채운 뒤엔 화면 밖으로 밀렸다.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import Icon from "@shared/ui/Icon";
import { Chip } from "@shared/ui/Chip";
import { useToast } from "@shared/ui/Toast";
import { useProducts } from "@shared/lib/products";
import { useReferenceMaterials, formatBytes } from "@shared/lib/referenceMaterials";
import { useCreativeDraft } from "@entities/creative/model";
import { OBJECTIVES_PHASE1, type ObjectiveId } from "@entities/creative/options";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { usePersonasForProfile } from "@features/brand-profile/model/usePersonasStorage";
import PersonaQuickCreateModal from "@features/brand-profile/ui/PersonaQuickCreateModal";
import { NumberBadge, PanelCard, SelectChip } from "./parts";

interface Props {
  brand: string;
  setBrand: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  productId: string | null;
  setProductId: (id: string | null) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  customBrand: boolean;
  setCustomBrand: (v: boolean) => void;
  onGenerate: () => void;
}

const inputBox =
  "w-full border border-[var(--w-line-normal)] rounded-[var(--w-radius-8)] px-3.5 py-[11px] bg-[var(--w-bg-normal)] font-normal text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-neutral)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)]";

export default function BriefStep(p: Props) {
  const creative = useCreativeDraft();
  const outcome = creative.state.outcome;
  const { data: session, status } = useSession();
  const browseMode = !!session?.browseMode;
  const { profile: bp, profiles, activeId } = useBrandProfileStorage(browseMode);
  const { products } = useProducts(activeId ?? "");
  const { personas, savePersona } = usePersonasForProfile(activeId ?? "");
  const { materials, upload } = useReferenceMaterials(activeId ?? "");
  const showToast = useToast();

  const hasBrandProfile = !!bp.brandDescription;
  const isProfileMode = hasBrandProfile && !p.customBrand;
  const [personaModal, setPersonaModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // 프로필이 아예 없으면 직접입력을 기본 노출 — 안 그러면 생성에 넣을 브랜드 설명이 비어버린다.
  useEffect(() => {
    if (status !== "loading" && !browseMode && !hasBrandProfile) p.setCustomBrand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, browseMode, hasBrandProfile]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!activeId) {
      showToast("브랜드 프로필을 먼저 만들어야 근거 자료를 올릴 수 있어요");
      return;
    }
    for (const file of Array.from(files)) {
      try {
        await upload(file);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "파일을 올리지 못했어요");
      }
    }
  };

  return (
    <div className="bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] overflow-hidden max-w-[856px] mx-auto">
      <div className="px-7 pt-6 pb-3">
        <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] mb-1">
          광고 만들기 · STEP 01
        </div>
        <h1 className="m-0 font-bold text-[26px] leading-[1.35] tracking-[-0.02em] text-[var(--w-fg-strong)]">
          무엇을 알릴지 알려주세요
        </h1>
        <p className="m-0 mt-1 font-normal text-[14px] leading-[1.5] text-[var(--w-fg-neutral)]">
          3가지만 채우면 소재 3안이 바로 만들어져요. 나머지는 나중에 바꿔도 괜찮아요.
        </p>
      </div>

      <div className="px-7 pt-2 pb-6 flex flex-col gap-3">
        {/* ① 제품 · 서비스 */}
        <PanelCard className="p-[18px]">
          <div className="flex items-center gap-2 mb-2.5">
            <NumberBadge n={1} />
            <span className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">제품 · 서비스</span>
          </div>

          {isProfileMode && products.length > 0 ? (
            <Select
              value={p.productId ?? ""}
              onChange={(v) => p.setProductId(v || null)}
              placeholder="제품을 골라주세요 (선택 안 하면 브랜드 전체 광고)"
              options={products.map((pr) => ({ value: pr.id, label: pr.name }))}
            />
          ) : (
            <textarea
              className={`${inputBox} resize-y min-h-[72px]`}
              value={p.brand}
              onChange={(e) => p.setBrand(e.target.value)}
              placeholder="어떤 브랜드·제품을 홍보하나요? 예) 민감성 피부를 위한 저자극 식물성 수분 크림"
            />
          )}

          <textarea
            className={`${inputBox} mt-2 resize-y min-h-[56px] leading-[1.6]`}
            value={creative.state.outcomeHint}
            onChange={(e) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: e.target.value })}
            placeholder="한 줄 설명 — 예: 민감성 피부를 위한 저자극 식물성 수분 크림"
          />

          {isProfileMode && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Chip variant="accent" size="sm">
                {profiles.find((pr) => pr.id === activeId)?.name ?? "브랜드 프로필"}
              </Chip>
              <span className="font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] line-clamp-1 flex-1 min-w-0">
                {bp.brandDescription}
              </span>
              <button
                type="button"
                onClick={() => p.setCustomBrand(true)}
                className="font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] cursor-pointer shrink-0"
              >
                직접입력
              </button>
            </div>
          )}
          {!isProfileMode && hasBrandProfile && (
            <button
              type="button"
              onClick={() => p.setCustomBrand(false)}
              className="mt-2.5 font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-primary-normal)] cursor-pointer"
            >
              ← 브랜드 프로필 다시 사용
            </button>
          )}
        </PanelCard>

        {/* ② 광고 목표 */}
        <PanelCard className="p-[18px]">
          <div className="flex items-center gap-2 mb-2.5">
            <NumberBadge n={2} />
            <span className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">광고 목표</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {OBJECTIVES_PHASE1.map((o) => (
              <SelectChip
                key={o.id}
                active={outcome === o.id}
                onClick={() => creative.dispatch({ type: "SET_OUTCOME", outcome: o.id as ObjectiveId })}
                title={o.outcomeDescription}
              >
                {o.label}
              </SelectChip>
            ))}
          </div>
        </PanelCard>

        {/* ③ 누구에게 보여줄까요 */}
        <PanelCard className="p-[18px]">
          <div className="flex items-center gap-2 mb-2.5">
            <NumberBadge n={3} />
            <span className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">누구에게 보여줄까요</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {personas.map((pe) => (
              <SelectChip
                key={pe.id}
                active={p.personaId === pe.id}
                onClick={() => p.setPersonaId(p.personaId === pe.id ? null : pe.id)}
                title={pe.customerDescription}
              >
                {pe.name}
              </SelectChip>
            ))}
            <SelectChip onClick={() => setPersonaModal(true)}>+ 새 페르소나</SelectChip>
          </div>
          {!isProfileMode && (
            <textarea
              className={`${inputBox} mt-2.5 resize-y min-h-[56px] leading-[1.6]`}
              value={p.target}
              onChange={(e) => p.setTarget(e.target.value)}
              placeholder="타겟의 직업·나이·관심사·라이프스타일을 적어주세요"
            />
          )}
        </PanelCard>

        {/* 근거 자료 (선택) */}
        <PanelCard className="p-[18px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">근거 자료</span>
            <Chip variant="neutral" size="sm">선택</Chip>
          </div>
          <p className="m-0 mb-2.5 font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
            인증서·리뷰·수상 내역을 올리면 카피에 근거로 인용돼요.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
            className={`w-full border border-dashed rounded-[var(--w-radius-12)] px-5 py-5 text-center font-medium text-[13px] leading-[1.5] cursor-pointer transition-colors duration-[120ms] ${
              dragging
                ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]"
                : "border-[var(--w-line-normal)] bg-[var(--w-bg-neutral)] text-[var(--w-fg-neutral)]"
            }`}
          >
            파일을 끌어다 놓거나 클릭해서 올려주세요 · PDF, 이미지
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
          {materials.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2.5">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center gap-2 min-w-0">
                  <Icon name="doc" size={13} className="shrink-0 text-[var(--w-fg-neutral)]" />
                  <span className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-normal)] truncate">{m.name}</span>
                  <span className="font-normal text-[11px] leading-[1.5] text-[var(--w-fg-alternative)] shrink-0">
                    {formatBytes(m.sizeBytes)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {bp.proofPoints && bp.proofPoints.some((t) => t.trim()) && (
            <div className="flex gap-1.5 flex-wrap mt-2.5">
              {bp.proofPoints.filter((t) => t.trim()).slice(0, 4).map((t) => (
                <Chip key={t} variant="success" size="sm">{t}</Chip>
              ))}
            </div>
          )}
        </PanelCard>

        <div className="flex flex-col items-center gap-2 mt-3">
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={p.onGenerate}
            disabled={!outcome}
            title={!outcome ? "광고 목표를 먼저 골라주세요" : undefined}
            className="min-w-[240px]"
          >
            <Icon name="sparkles" size={15} /> 소재 3안 만들기
          </Button>
          <p className="m-0 font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">약 4초 걸려요</p>
        </div>
      </div>

      {personaModal && (
        <PersonaQuickCreateModal
          activeBrandProfileId={activeId}
          profiles={profiles}
          onSave={(entry) => {
            savePersona(entry);
            p.setPersonaId(entry.id);
            setPersonaModal(false);
          }}
          onClose={() => setPersonaModal(false)}
        />
      )}
    </div>
  );
}
