"use client";

// ADR-040 — 소재 만들기 phase 2(이미지). 선택된 카피를 상단 요약(읽기전용)으로 접고,
// 이미지 컨셉·생성에 집중. "← 카피 수정"으로 phase 1 복귀. 최상위 Stepper(STEP 02=집행) 불변.

import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useCreativeDraft } from "@entities/creative/model";
import { useProducts } from "@shared/lib/products";
import { readActiveBrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import AiImageBlock from "./AiImageBlock";
import TextOverlayEditor from "./TextOverlayEditor";

export default function ImagePhase({
  productId,
  imageDataUrl,
  setImageDataUrl,
  finalImageDataUrl,
  setFinalImageDataUrl,
  onBackToCopy,
  onNext,
}: {
  productId: string | null;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
  finalImageDataUrl: string | null;
  setFinalImageDataUrl: (v: string | null) => void;
  onBackToCopy: () => void;
  onNext: () => void;
}) {
  const { state } = useCreativeDraft();
  const [editing, setEditing] = useState(false);
  const [copyExpanded, setCopyExpanded] = useState(false);

  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);

  const activeBrandProfileId = readActiveBrandProfileEntry()?.id ?? "";
  const { products } = useProducts(activeBrandProfileId);
  const product = productId ? products.find((p) => p.id === productId) ?? null : null;

  useEffect(() => {
    if (!zoomedSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedSrc]);

  const handleSelectImage = (v: string | null) => {
    if (v !== imageDataUrl) setFinalImageDataUrl(null);
    setImageDataUrl(v);
  };

  return (
    <Card variant="lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">이미지 만들기</h2>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">선택한 카피에 어울리는 이미지를 빚어 보세요.</p>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={onBackToCopy} className="border border-[var(--w-line-normal)]">
          <Icon name="arrow-left" size={14} /> 카피 수정
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ margin: "16px 0 18px" }}>
        <div className="flex flex-col gap-2 px-4 py-[14px] rounded-xl bg-[var(--w-bg-alternative)]">
          <div className="flex items-center gap-2">
            <Badge kind="neutral">선택한 카피</Badge>
          </div>
          <div className="font-[600] text-[14.5px] leading-[1.4] text-[var(--w-fg-strong)]">{state.headline}</div>
          {state.subtitle?.trim() && (
            <div className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)] -mt-1">{state.subtitle}</div>
          )}
          {state.primaryText && (
            <>
              <div className={cn("font-medium text-[13px] leading-[1.55] text-[var(--w-fg-normal)] whitespace-pre-wrap", !copyExpanded && "line-clamp-2")}>
                {state.primaryText}
              </div>
              <button
                type="button"
                aria-expanded={copyExpanded}
                onClick={() => setCopyExpanded((v) => !v)}
                className="self-start inline-flex items-center gap-1 font-semibold text-[11.5px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] cursor-pointer transition-[color] duration-[120ms]"
              >
                <Icon name="chev-down" size={12} style={{ transform: copyExpanded ? "none" : "rotate(-90deg)", transition: "transform 120ms" }} />
                {copyExpanded ? "본문 접기" : "본문 전체"}
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4 py-[14px] rounded-xl bg-[var(--w-bg-alternative)]">
          <div className="flex items-center gap-2">
            <Badge kind="neutral">선택한 제품</Badge>
          </div>
          {product ? (
            <div className="flex items-start gap-3">
              {product.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setZoomedSrc(product.imageUrl!)}
                  className="relative group flex-none rounded-[10px] overflow-hidden border border-[var(--w-line-normal)]"
                  style={{ width: 96, height: 96, cursor: "zoom-in", padding: 0 }}
                  aria-label="제품 사진 크게 보기"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <span className="absolute bottom-1 right-1 grid place-items-center w-[22px] h-[22px] rounded-md bg-[rgba(255,255,255,0.94)] text-[var(--w-fg-normal)] shadow-[0_1px_3px_rgba(0,0,0,0.18)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" />
                      <path d="M11 8v6M8 11h6" />
                    </svg>
                  </span>
                </button>
              ) : (
                <span className="grid place-items-center w-[96px] h-[96px] rounded-[10px] bg-[var(--w-bg-elevated)] text-[var(--w-fg-neutral)] flex-none">
                  <Icon name="image" size={24} />
                </span>
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="font-[600] text-[14px] leading-[1.4] text-[var(--w-fg-strong)] truncate">{product.name}</div>
                {product.price?.trim() && (
                  <div className="font-semibold text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">{product.price}</div>
                )}
                {product.description?.trim() && (
                  <div className="font-medium text-[11.5px] leading-[1.45] text-[var(--w-fg-normal)] line-clamp-2 mt-0.5">{product.description}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] py-2">
              <Icon name="image" size={16} /> 선택된 제품이 없어요.
            </div>
          )}
        </div>
      </div>

      <AiImageBlock productId={productId} imageDataUrl={imageDataUrl} finalImageDataUrl={finalImageDataUrl} setImageDataUrl={handleSelectImage} />

      <div className="relative overflow-hidden flex items-center justify-between gap-4 mt-[18px] px-5 py-4 rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] shadow-[var(--w-shadow-strong)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(50% 180% at 100% 50%, var(--w-accent-violet-soft), transparent 60%), radial-gradient(40% 160% at 0% 100%, var(--w-primary-soft), transparent 60%)" }}
        />
        <div className="relative z-[1] flex items-center gap-3 min-w-0">
          {imageDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={finalImageDataUrl ?? imageDataUrl} alt="선택한 이미지" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: "1.5px solid var(--w-primary-normal)", flex: "none" }} />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[10.5px] leading-none tracking-[0.06em] uppercase text-[var(--w-primary-press)]">
                  <Icon name="check" size={12} /> {finalImageDataUrl ? "텍스트 적용됨" : "선택 완료"}
                </span>
                <span className="font-semibold text-[14.5px] leading-[1.35] text-[var(--w-fg-strong)] truncate">이 이미지로 광고를 만들어요</span>
              </div>
            </>
          ) : (
            <>
              <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] flex-none">
                <Icon name="image" size={16} />
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[10.5px] leading-none tracking-[0.06em] uppercase text-[var(--w-accent-violet)]">
                  <Icon name="sparkles" size={12} /> 마지막 단계
                </span>
                <span className="font-semibold text-[14.5px] leading-[1.35] text-[var(--w-fg-strong)]">이미지 1장을 선택하면 진행할 수 있어요</span>
              </div>
            </>
          )}
        </div>
        <div className="relative z-[1] flex items-center gap-2.5 flex-none">
          <Button
            variant="ghost"
            type="button"
            disabled={!imageDataUrl}
            onClick={() => setEditing(true)}
            className="border border-[var(--w-line-normal)]"
          >
            <Icon name="edit" size={14} /> 텍스트 편집
          </Button>
          <Button variant="primary" type="button" disabled={!imageDataUrl} onClick={onNext}>다음: 광고 집행 <Icon name="arrow-right" size={14} /></Button>
        </div>
      </div>
      <p className="text-[11.5px] font-medium text-[var(--w-fg-alternative)] mt-2.5 mb-0 text-center">
        AI가 만든 이미지예요 — 정책·저작권·초상권은 직접 확인해주세요.
      </p>

      {zoomedSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          onClick={() => setZoomedSrc(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24, cursor: "zoom-out" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedSrc}
            alt="확대 이미지"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "min(92vw, 1200px)", maxHeight: "92vh", objectFit: "contain", borderRadius: 8, cursor: "default", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "block" }}
          />
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setZoomedSrc(null)}
            style={{ position: "fixed", top: 16, right: 16, width: 36, height: 36, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.94)", color: "#111", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {editing && imageDataUrl && (
        <TextOverlayEditor
          baseImageUrl={imageDataUrl}
          headlineSuggestion={state.headline}
          subtitleSuggestion={state.subtitle || undefined}
          overlayHeadlines={state.overlayHeadlines ?? undefined}
          onClose={() => setEditing(false)}
          onSave={(final) => setFinalImageDataUrl(final)}
        />
      )}
    </Card>
  );
}
