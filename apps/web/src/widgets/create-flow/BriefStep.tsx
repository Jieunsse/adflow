"use client";

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
import { findObjective, OBJECTIVES_PHASE1, type ObjectiveId } from "@entities/creative/options";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { usePersonasForProfile } from "@features/brand-profile/model/usePersonasStorage";
import PersonaQuickCreateModal from "@features/brand-profile/ui/PersonaQuickCreateModal";
import type { QuickStartSettings } from "@entities/campaign/model";
import { SelectChip } from "./parts";

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
  mode: "quick" | "detailed";
  setMode: (mode: "quick" | "detailed") => void;
  quickStart: QuickStartSettings | null;
  onGenerate: () => void;
}

const inputBox =
  "w-full rounded-[var(--w-radius-8)] border border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] px-3.5 py-3 text-[14px] leading-[1.55] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-neutral)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)]";

const OBJECTIVE_LABELS: Record<ObjectiveId, string> = {
  awareness: "더 많은 사람에게 알리기",
  traffic: "웹사이트로 보내기",
  traffic_page_visit: "Facebook 페이지로 보내기",
  engagement: "게시물 반응 늘리기",
  engagement_page_likes: "페이지 팔로워 늘리기",
  engagement_messages: "메시지 문의 받기",
  leads_call: "전화 문의 받기",
  boost_post: "기존 콘텐츠 홍보하기",
  leads: "잠재고객 늘리기",
  sales: "판매 늘리기",
  app_promotion: "앱 설치 늘리기",
};

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
  const [personaModal, setPersonaModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [briefStage, setBriefStage] = useState<1 | 2 | 3>(1);

  const hasBrandProfile = !!bp.brandDescription;
  const isProfileMode = hasBrandProfile && !p.customBrand;
  const selectedProduct = products.find((product) => product.id === p.productId);
  const selectedPersona = personas.find((persona) => persona.id === p.personaId);
  const proofPoints = (bp.proofPoints ?? []).filter((proof) => proof.trim());
  const selectedObjective = outcome ? findObjective(outcome) : null;
  const productSummary = selectedProduct?.name
    ?? (isProfileMode ? "브랜드 전체" : p.brand.trim() || "아직 입력하지 않았어요");
  const audienceSummary = selectedPersona?.name ?? (p.target.trim() || "선택하지 않았어요");
  const briefStages = p.mode === "quick"
    ? [["01", "목표"], ["02", "제품"]]
    : [["01", "목표"], ["02", "제품 · 고객"], ["03", "메시지 · 근거"]];

  useEffect(() => {
    if (status !== "loading" && !browseMode && !hasBrandProfile) p.setCustomBrand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, browseMode, hasBrandProfile]);

  useEffect(() => {
    if (!outcome) setBriefStage(1);
  }, [outcome]);

  useEffect(() => {
    setBriefStage(1);
  }, [p.mode]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!activeId) {
      showToast("브랜드 프로필을 먼저 만들어야 자료를 올릴 수 있어요");
      return;
    }
    for (const file of Array.from(files)) {
      try {
        await upload(file);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "파일을 올리지 못했어요");
      }
    }
  };

  return (
    <div className="mx-auto w-full">
      <header className="mb-6 border-b border-[var(--w-line-alternative)] pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="w-overline m-0 text-[var(--w-primary-normal)]">광고 만들기 · 시작하기</p>
            <h1 className="w-display-editorial m-0 mt-2">이번 광고가 만들<br className="sm:hidden" /> 변화부터 정해요</h1>
          </div>
          <p className="w-caption m-0 max-w-[280px] lg:text-right">필요한 정보만 순서대로 고르면, 다음 단계에서 광고 문구와 소재를 만들어요.</p>
        </div>
        <div className="mt-6 grid gap-2 rounded-[var(--w-radius-12)] bg-[var(--w-bg-alternative)] p-2 sm:grid-cols-2" aria-label="광고 만들기 방식">
          <button
            type="button"
            aria-pressed={p.mode === "quick"}
            onClick={() => p.setMode("quick")}
            className={`rounded-[var(--w-radius-8)] px-3 py-3 text-left ${p.mode === "quick" ? "bg-[var(--w-primary-soft)]" : "hover:bg-[var(--w-bg-normal)]"}`}
          >
            <span className="w-label block text-[var(--w-fg-strong)]">빠르게 만들기</span>
            <span className="w-caption mt-1 block">목표와 제품만 고르면 최근 설정을 적용해요.</span>
          </button>
          <button
            type="button"
            aria-pressed={p.mode === "detailed"}
            onClick={() => p.setMode("detailed")}
            className={`rounded-[var(--w-radius-8)] px-3 py-3 text-left ${p.mode === "detailed" ? "bg-[var(--w-primary-soft)]" : "hover:bg-[var(--w-bg-normal)]"}`}
          >
            <span className="w-label block text-[var(--w-fg-strong)]">상세 설정</span>
            <span className="w-caption mt-1 block">고객·메시지·근거까지 직접 정해요.</span>
          </button>
        </div>
        {p.mode === "quick" && p.quickStart && (
          <p className="w-caption m-0 mt-3 rounded-[var(--w-radius-8)] bg-[var(--w-primary-soft)] px-3 py-2 text-[var(--w-primary-heavy)]">최근 광고 설정을 적용했어요. 게재 전에는 모두 바꿀 수 있어요.</p>
        )}
        <div className={`mt-3 grid gap-2 rounded-[var(--w-radius-12)] bg-[var(--w-bg-alternative)] p-2 ${p.mode === "quick" ? "grid-cols-2" : "grid-cols-3"}`} aria-label="광고 브리프 구성">
          {briefStages.map(([number, label]) => (
            <button
              key={number}
              type="button"
              onClick={() => setBriefStage(Number(number) as 1 | 2 | 3)}
              disabled={number !== "01" && !outcome}
              aria-current={briefStage === Number(number) ? "step" : undefined}
              className={`rounded-[var(--w-radius-8)] px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${briefStage === Number(number) ? "bg-[var(--w-primary-soft)]" : "hover:bg-[var(--w-bg-normal)]"}`}
            >
              <span className={`mr-2 inline-grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${briefStage === Number(number) ? "bg-[var(--w-primary-normal)] text-[var(--w-primary-on)]" : "bg-[var(--w-bg-neutral)] text-[var(--w-fg-neutral)]"}`}>{number}</span>
              <span className="w-caption text-[var(--w-fg-strong)]">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {briefStage === 1 && <section className="rounded-[var(--w-radius-20)] border border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="w-overline m-0 text-[var(--w-primary-normal)]">01 · 광고 목표</p>
                <h2 className="w-h2 m-0 mt-1">어떤 행동을 만들까요?</h2>
              </div>
              <p className="w-caption m-0 max-w-[280px]">목표 하나만 고르면 소재 메시지와 버튼의 방향이 정해져요.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {OBJECTIVES_PHASE1.map((objective) => {
                const active = outcome === objective.id;
                return (
                  <button
                    key={objective.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      creative.dispatch({ type: "SET_OUTCOME", outcome: objective.id as ObjectiveId });
                      setBriefStage(2);
                    }}
                    className={`relative min-h-[88px] rounded-[var(--w-radius-12)] border p-3.5 text-left transition-[background,border-color] duration-[120ms] ${
                      active
                        ? "border-2 border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] p-[13px]"
                        : "border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] hover:border-[var(--w-primary-normal)] hover:bg-[var(--w-primary-soft)]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`grid h-6 w-6 place-items-center rounded-[var(--w-radius-6)] ${active ? "bg-[var(--w-primary-normal)] text-[var(--w-primary-on)]" : "bg-[var(--w-bg-neutral)] text-[var(--w-fg-neutral)]"}`}>
                        <Icon name={objective.iconName} size={13} />
                      </span>
                      <span className="text-[14px] font-semibold leading-[1.4] tracking-[-0.015em] text-[var(--w-fg-strong)]">{OBJECTIVE_LABELS[objective.id]}</span>
                    </span>
                    {active && <Icon name="check" size={14} className="absolute right-3.5 top-3.5 text-[var(--w-primary-normal)]" />}
                  </button>
                );
              })}
            </div>
            <div className={`mt-4 rounded-[var(--w-radius-12)] px-3.5 py-3 ${selectedObjective ? "bg-[var(--w-primary-soft)]" : "bg-[var(--w-bg-neutral)]"}`} aria-live="polite">
              <p className={`w-caption m-0 ${selectedObjective ? "text-[var(--w-primary-heavy)]" : ""}`}>
                {selectedObjective && "outcomeDescription" in selectedObjective ? selectedObjective.outcomeDescription : "목표를 고르면 다음에 채울 정보가 열려요."}
              </p>
            </div>
          </section>}

          {briefStage === 2 && outcome && (
            <div className={`overflow-hidden rounded-[var(--w-radius-16)] border border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] ${p.mode === "detailed" ? "lg:grid lg:grid-cols-2" : ""}`}>
              <div className={p.mode === "detailed" ? "border-b border-[var(--w-line-alternative)] lg:border-b-0 lg:border-r" : ""}>
                <BriefSection number="02" title="어떤 제품을 보러 오게 할까요?" description="제품을 고르면 저장된 브랜드 정보가 자동으로 카피에 반영돼요." last>
            <label className="w-label mb-2 flex items-center justify-between gap-3">
              <span>{isProfileMode ? "홍보할 제품 · 서비스" : "홍보할 브랜드 · 제품"}</span>
              <span className="text-[11px] font-semibold text-[var(--w-primary-normal)]">{isProfileMode ? "선택" : "필수"}</span>
            </label>
            {isProfileMode && products.length > 0 ? (
              <Select
                value={p.productId ?? ""}
                onChange={(value) => p.setProductId(value || null)}
                placeholder="제품을 골라주세요 · 선택하지 않으면 브랜드 전체를 알려요"
                options={products.map((product) => ({ value: product.id, label: product.name }))}
              />
            ) : (
              <textarea
                className={`${inputBox} min-h-[104px] resize-y`}
                value={p.brand}
                onChange={(event) => p.setBrand(event.target.value)}
                placeholder="예) 민감성 피부를 위한 저자극 식물성 수분 크림"
                autoFocus
              />
            )}
            {isProfileMode && (
              <div className="mt-3 flex items-center gap-2 rounded-[var(--w-radius-8)] bg-[var(--w-bg-neutral)] px-3 py-2.5">
                <Chip variant="accent" size="sm">{profiles.find((profile) => profile.id === activeId)?.name ?? "브랜드 프로필"}</Chip>
                <span className="min-w-0 flex-1 truncate text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">{selectedProduct?.description ?? bp.brandDescription}</span>
                <button type="button" onClick={() => p.setCustomBrand(true)} className="shrink-0 text-[12px] font-semibold text-[var(--w-primary-normal)]">직접 입력하기</button>
              </div>
            )}
            {!isProfileMode && hasBrandProfile && (
              <button type="button" onClick={() => p.setCustomBrand(false)} className="mt-3 text-[12px] font-semibold text-[var(--w-primary-normal)]">브랜드 프로필 사용하기</button>
            )}
                </BriefSection>
              </div>

              {p.mode === "detailed" && <BriefSection number="03" title="누구에게 이 말을 건넬까요?" description="가장 먼저 설득하고 싶은 고객을 고르면 메시지가 더 구체적으로 만들어져요." last>
            {isProfileMode ? (
              <>
                <p className="w-label mb-3 flex items-center justify-between gap-3"><span>고객</span><span className="text-[11px] font-semibold text-[var(--w-primary-normal)]">선택</span></p>
                <div className="flex flex-wrap gap-2">
                  {personas.map((persona) => (
                    <SelectChip
                      key={persona.id}
                      active={p.personaId === persona.id}
                      onClick={() => p.setPersonaId(p.personaId === persona.id ? null : persona.id)}
                      title={persona.customerDescription}
                    >
                      {persona.name}
                    </SelectChip>
                  ))}
                  <SelectChip className="border-dashed" onClick={() => setPersonaModal(true)}>+ 새 고객 추가</SelectChip>
                </div>
              </>
            ) : (
              <>
                <label className="w-label mb-2 block" htmlFor="customer-description">직접 입력한 고객 설명 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span></label>
                <textarea id="customer-description" className={`${inputBox} min-h-[96px] resize-y`} value={p.target} onChange={(event) => p.setTarget(event.target.value)} placeholder="예) 20대 여성 대학생 · 민감성 피부 관리에 관심이 많아요" />
              </>
            )}
              </BriefSection>}
            </div>
          )}

          {briefStage === 3 && outcome && (
            <div className="overflow-hidden rounded-[var(--w-radius-16)] border border-[var(--w-line-normal)] bg-[var(--w-bg-normal)]">
              <BriefSection number="04" title="광고에서 남길 한마디를 적어주세요" description="제품 설명 전체가 아니라, 이번 광고에서 가장 먼저 말할 이유 하나면 충분해요.">
            <label className="w-label mb-2 block" htmlFor="outcome-hint">강조할 내용 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span></label>
            <textarea id="outcome-hint" className={`${inputBox} min-h-[96px] resize-y`} value={creative.state.outcomeHint} onChange={(event) => creative.dispatch({ type: "SET_OUTCOME_HINT", hint: event.target.value })} placeholder="예) 개강 전, 민감해진 피부를 편안하게 관리할 수 있다는 점을 알리고 싶어요" />
            <p className="w-caption m-0 mt-2">고객이 얻는 변화, 지금 필요한 이유, 꼭 알려야 할 차별점 중 하나를 적어주세요.</p>
              </BriefSection>

              <BriefSection number="05" title="믿을 만한 이유를 더할까요?" description="저장된 근거는 광고 문구에 활용해요. 이번 작업에 참고할 자료도 추가할 수 있어요." last>
            <div className="rounded-[var(--w-radius-12)] border border-[var(--w-line-alternative)] bg-[var(--w-bg-neutral)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="w-label m-0">{proofPoints.length ? "저장된 근거" : "저장된 근거가 없어요"}</p>
                  <p className="w-caption m-0 mt-1">{proofPoints.length ? "카피에 활용할 수 있는 검증된 정보예요." : "브랜드 프로필에서 근거를 추가하면 카피에 활용할 수 있어요."}</p>
                  {proofPoints.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{proofPoints.slice(0, 4).map((proof) => <Chip key={proof} variant="success" size="sm">{proof}</Chip>)}</div>}
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 text-left text-[12px] font-semibold text-[var(--w-primary-normal)]">자료 추가하기</button>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,text/plain" className="hidden" onChange={(event) => { void handleFiles(event.target.files); event.target.value = ""; }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files); }}
                className={`mt-4 w-full rounded-[var(--w-radius-8)] border border-dashed px-4 py-3 text-center text-[12px] font-medium transition-colors ${dragging ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] text-[var(--w-fg-neutral)]"}`}
              >
                파일을 끌어다 놓거나 클릭해서 올려주세요 · PDF, 이미지, TXT
              </button>
              {materials.length > 0 && <div className="mt-3 flex flex-col gap-1.5">{materials.map((material) => <div key={material.id} className="flex min-w-0 items-center gap-2"><Icon name="doc" size={13} className="shrink-0 text-[var(--w-fg-neutral)]" /><span className="truncate text-[12px] font-medium text-[var(--w-fg-normal)]">{material.name}</span><span className="shrink-0 text-[11px] text-[var(--w-fg-alternative)]">{formatBytes(material.sizeBytes)}</span></div>)}</div>}
            </div>
              </BriefSection>
            </div>
          )}
        </div>

        <aside aria-label="광고 브리프 요약" className="sticky top-6 flex flex-col overflow-hidden rounded-[var(--w-radius-16)] border border-[var(--w-line-normal)] bg-[var(--w-bg-normal)] lg:min-h-[430px]">
          <div className="border-b border-[var(--w-line-alternative)] px-4 py-4">
            <p className="w-overline m-0 text-[var(--w-primary-normal)]">광고 설계 메모</p>
            <p className="w-body-strong m-0 mt-1">만들어질 광고</p>
          </div>
          <div className="p-4">
            <SummaryField label="목표"><div className="flex items-center gap-2 rounded-[var(--w-radius-8)] bg-[var(--w-primary-soft)] px-2.5 py-2"><span className="grid h-6 w-6 place-items-center rounded-[var(--w-radius-6)] bg-[var(--w-primary-normal)] text-[var(--w-primary-on)]"><Icon name={selectedObjective?.iconName ?? "target"} size={13} /></span><span className="text-[12px] font-semibold text-[var(--w-primary-heavy)]">{selectedObjective?.label ?? "아직 고르지 않았어요"}</span></div></SummaryField>
            <div className="my-4 h-px bg-[var(--w-line-alternative)]" />
            <SummaryField label="제품">{productSummary}</SummaryField>
            <SummaryField label="우선 고객">{audienceSummary}</SummaryField>
            <SummaryField label="사용할 근거" last>{proofPoints.length ? proofPoints.slice(0, 3).join(" · ") : "저장된 근거 없음"}</SummaryField>
          </div>
          <div className="mt-auto border-t border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)] p-3.5">
            {(briefStage === 3 || (p.mode === "quick" && briefStage === 2)) ? (
              <>
                <Button variant="primary" size="lg" type="button" className="w-full" onClick={p.onGenerate}>
                  <Icon name="sparkles" size={15} /> 소재 3안 만들기
                </Button>
                <p className="m-0 mt-2 text-center text-[11px] leading-[1.45] text-[var(--w-fg-neutral)]">선택한 목표를 바탕으로 서로 다른 3안을 만들어요.</p>
              </>
            ) : (
              <Button
                variant="primary"
                size="lg"
                type="button"
                className="w-full"
                onClick={() => setBriefStage(briefStage === 1 ? 2 : 3)}
                disabled={!outcome}
                title={!outcome ? "광고 목표를 선택해주세요" : undefined}
              >
                다음: {briefStage === 1 ? (p.mode === "quick" ? "제품 고르기" : "제품과 고객 정하기") : "메시지와 근거 정하기"}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {personaModal && <PersonaQuickCreateModal activeBrandProfileId={activeId} profiles={profiles} onSave={(entry) => { savePersona(entry); p.setPersonaId(entry.id); setPersonaModal(false); }} onClose={() => setPersonaModal(false)} />}
    </div>
  );
}

function BriefSection({ number, title, description, children, last = false }: { number: string; title: string; description: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`px-5 py-6 sm:px-8 sm:py-7 ${last ? "" : "border-b border-[var(--w-line-alternative)]"}`}>
      <div className="mb-5 flex gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--w-radius-8)] bg-[var(--w-primary-soft)] text-[12px] font-bold text-[var(--w-primary-heavy)]">{number}</span>
        <div><h2 className="w-h3 m-0">{title}</h2><p className="w-caption m-0 mt-1">{description}</p></div>
      </div>
      {children}
    </section>
  );
}

function SummaryField({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return <div className={last ? "" : "mb-4"}><p className="m-0 mb-1 text-[11px] font-semibold tracking-[0.04em] text-[var(--w-fg-neutral)]">{label}</p><div className="text-[12px] font-semibold leading-[1.5] text-[var(--w-fg-strong)]">{children}</div></div>;
}
