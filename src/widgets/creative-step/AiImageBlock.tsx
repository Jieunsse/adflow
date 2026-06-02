"use client";

// ADR-040 — 소재 만들기 phase 2 본체. 두 탭:
//  · 기본(concept): 카피 기반 Image Concept 3개(다축 분기) 카드 — 슬롯별 prompt 편집·개별 재생성.
//  · 보조(brief): 연출컷·자료 기반 외주 기획안. variants[] 통일 계약(동일 prompt 3복제)으로 흡수.
// Package Reference: 선택 Product imageUrl 자동 + 수동 교체. 전 variant 공통 referenceImages 로 합류.

import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/cn";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import type { ImageVariant, ReferenceImage } from "@/lib/gemini-image";
import { fetchImageStream } from "@features/generate-image/image-stream";
import { splitDataUrl, buildBriefRefs, computeBriefTargets } from "@features/generate-image/brief-refs";
import type {
  ImageConcept,
  SuggestImageConceptsParams,
  SuggestImageConceptsResult,
} from "@/lib/gemini-creative";
import { useCreativeDraft } from "@entities/creative/model";
import { useToast } from "@shared/ui/Toast";
import { buildBriefPrompt } from "@features/generate-image/brief-prompt";
import { readActiveBrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import { useReferenceMaterials, type ReferenceMaterial } from "@shared/lib/referenceMaterials";
import type { ProductEntry } from "@shared/lib/products";
import BriefForm, { type AspectId } from "./BriefForm";

const MAX_REF_MB = 3;

type AiImageMode = "concept" | "brief";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    r.readAsDataURL(file);
  });
}

// URL(원격 또는 data:)을 Package Reference 용 base64 ReferenceImage 로 변환.
async function urlToRef(url: string): Promise<{ ref: ReferenceImage; preview: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const ref = splitDataUrl(url);
      return ref ? { ref, preview: url } : null;
    }
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("이미지 인코딩 실패"));
      r.readAsDataURL(blob);
    });
    const ref = splitDataUrl(dataUrl);
    return ref ? { ref, preview: dataUrl } : null;
  } catch {
    return null;
  }
}

const EMPTY_CONCEPTS: ImageConcept[] = [
  { label: "", prompt: "" },
  { label: "", prompt: "" },
  { label: "", prompt: "" },
];

export default function AiImageBlock({
  productId,
  imageDataUrl,
  setImageDataUrl,
}: {
  productId: string | null;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
}) {
  const { state, dispatch } = useCreativeDraft();
  const showToast = useToast();
  const [mode, setMode] = useState<AiImageMode>("concept");
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);
  const [pendingSlots, setPendingSlots] = useState<number[]>([]);
  const [rerollingSlots, setRerollingSlots] = useState<number[]>([]);
  const suggest = useApiMutation<SuggestImageConceptsParams, SuggestImageConceptsResult>("/api/suggest-image-concepts");
  const rerollOne = useApiMutation<SuggestImageConceptsParams, SuggestImageConceptsResult>("/api/suggest-image-concepts");

  // concept 모드 — 슬롯 i ↔ concept i ↔ generatedImages[i].
  const [concepts, setConcepts] = useState<ImageConcept[]>(EMPTY_CONCEPTS);
  // Package Reference — 전 variant 공통.
  const [packageRef, setPackageRef] = useState<{ ref: ReferenceImage; preview: string } | null>(null);
  const [packageRefOn, setPackageRefOn] = useState(true);
  // 선택 Product 의 name·description — 컨셉 제안 시 제품 형태 grounding 용.
  const [productMeta, setProductMeta] = useState<{ name: string; description: string } | null>(null);

  // brief 모드
  const [scenes, setScenes] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [aspect, setAspect] = useState<AspectId>("1:1");
  const [briefNotes, setBriefNotes] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<ReferenceMaterial[]>([]);
  const activeBrandProfileId = readActiveBrandProfileEntry()?.id ?? "";
  const { materials: warehouseMaterials, upload: uploadMaterial } = useReferenceMaterials(activeBrandProfileId);

  // 선택된 Product 의 imageUrl → Package Reference 자동 제안. name·description → 컨셉 grounding.
  useEffect(() => {
    if (!productId || !activeBrandProfileId) {
      setProductMeta(null);
      return;
    }
    let product: ProductEntry | undefined;
    try {
      const all = JSON.parse(localStorage.getItem(`adflow:products:${activeBrandProfileId}`) ?? "[]") as ProductEntry[];
      product = all.find((pr) => pr.id === productId);
    } catch {
      product = undefined;
    }
    setProductMeta(product ? { name: product.name, description: product.description } : null);
    const imageUrl = product?.imageUrl;
    if (!imageUrl) return;
    let cancelled = false;
    urlToRef(imageUrl).then((res) => {
      if (!cancelled && res) {
        setPackageRef(res);
        setPackageRefOn(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [productId, activeBrandProfileId]);

  useEffect(() => {
    if (!zoomedSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedSrc]);

  const allSlots = state.generatedImages; // null = 한 번도 생성 안 함
  const filledCount = allSlots ? allSlots.filter(Boolean).length : 0;
  const selectedIdx = imageDataUrl && allSlots ? allSlots.indexOf(imageDataUrl) : -1;
  const commonRefs = (): ReferenceImage[] | undefined =>
    packageRefOn && packageRef ? [packageRef.ref] : undefined;
  // Product Staging 활성 = 제품 레퍼런스가 켜져 있을 때. concept 모드에서만 preserve 로 흐른다.
  const stagingActive = packageRefOn && !!packageRef;

  // 지정한 슬롯들을 variants[] 로 생성. variants[k] → targets[k] 슬롯에 꽂는다.
  // preserve: ADR-041 Product Staging — concept 모드 한정. brief 연출컷은 항상 style guide(false).
  const runGenerate = async (targets: number[], variants: ImageVariant[], preserve = false) => {
    if (targets.length === 0) return;
    setPendingSlots((prev) => Array.from(new Set([...prev, ...targets])));
    const cur: [string, string, string] = state.generatedImages ?? ["", "", ""];
    const working: [string, string, string] = [cur[0], cur[1], cur[2]];
    try {
      await fetchImageStream({ variants, referenceImages: commonRefs(), preserveReference: preserve }, (serverIdx, image) => {
        const slot = targets[serverIdx];
        if (slot !== undefined) {
          working[slot] = image;
          dispatch({ type: "SET_GENERATED_IMAGES", images: [working[0], working[1], working[2]] });
        }
      });
      const filled = targets.filter((i) => working[i]).length;
      if (filled === 0) showToast("이미지가 생성되지 않았어요, 다시 시도해주세요");
      else if (filled < targets.length) showToast(`이미지 ${filled}장만 생성됐어요`);
    } catch (err) {
      console.error("[generate-image-stream]", err);
      showToast("이미지 생성에 실패했어요, 다시 시도해주세요");
    } finally {
      setPendingSlots((prev) => prev.filter((i) => !targets.includes(i)));
    }
  };

  const handleSuggestConcepts = () => {
    if (!state.primaryText?.trim()) {
      showToast("카피를 먼저 만들어 주세요");
      return;
    }
    suggest.mutate(
      {
        headline: state.headline,
        primaryText: state.primaryText,
        tone: state.tone,
        productName: productMeta?.name || undefined,
        productDescription: productMeta?.description || undefined,
        outcome: state.outcome ?? undefined,
        stageProduct: stagingActive,
      },
      {
        onSuccess: (data) => setConcepts(data.concepts.slice(0, 3)),
        onError: () => showToast("컨셉 제안에 실패했어요, 다시 시도해주세요"),
      },
    );
  };

  // 슬롯 하나의 프롬프트만 다시 제안 — 같은 엔드포인트로 3개를 받아 해당 인덱스만 교체.
  const handleRerollConcept = (i: number) => {
    if (!state.primaryText?.trim()) {
      showToast("카피를 먼저 만들어 주세요");
      return;
    }
    setRerollingSlots((prev) => Array.from(new Set([...prev, i])));
    rerollOne.mutate(
      {
        headline: state.headline,
        primaryText: state.primaryText,
        tone: state.tone,
        productName: productMeta?.name || undefined,
        productDescription: productMeta?.description || undefined,
        outcome: state.outcome ?? undefined,
        stageProduct: stagingActive,
      },
      {
        onSuccess: (data) => {
          const fresh = data.concepts[i] ?? data.concepts[0];
          if (fresh) setConcepts((prev) => prev.map((c, idx) => (idx === i ? fresh : c)));
        },
        onError: () => showToast("컨셉 제안에 실패했어요, 다시 시도해주세요"),
        onSettled: () => setRerollingSlots((prev) => prev.filter((s) => s !== i)),
      },
    );
  };

  const conceptRenderable = (i: number) => !!concepts[i]?.prompt.trim() || (packageRefOn && !!packageRef);

  const generateConceptSlot = (i: number) => {
    if (!conceptRenderable(i)) {
      showToast("컨셉 프롬프트를 입력하거나 제품 레퍼런스를 켜주세요");
      return;
    }
    runGenerate([i], [{ prompt: concepts[i]?.prompt ?? "" }], stagingActive);
  };

  const generateAllConcepts = () => {
    const targets = [0, 1, 2].filter(conceptRenderable);
    if (targets.length === 0) {
      showToast("AI 컨셉을 먼저 제안받거나 프롬프트를 입력해주세요");
      return;
    }
    runGenerate(targets, targets.map((i) => ({ prompt: concepts[i]?.prompt ?? "" })), stagingActive);
  };

  const handleRemoveImage = (slotIdx: number) => {
    if (!allSlots) return;
    if (imageDataUrl === allSlots[slotIdx]) setImageDataUrl(null);
    dispatch({
      type: "SET_GENERATED_IMAGES",
      images: [
        slotIdx === 0 ? "" : allSlots[0],
        slotIdx === 1 ? "" : allSlots[1],
        slotIdx === 2 ? "" : allSlots[2],
      ],
    });
  };

  const handleReplacePackageRef = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 첨부할 수 있어요");
      return;
    }
    if (file.size > MAX_REF_MB * 1024 * 1024) {
      showToast(`제품 레퍼런스는 ${MAX_REF_MB}MB 이하예요`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const ref = splitDataUrl(dataUrl);
      if (ref) {
        setPackageRef({ ref, preview: dataUrl });
        setPackageRefOn(true);
      }
    } catch {
      showToast("이미지를 읽지 못했어요");
    }
  };

  const handleAddScenes = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        showToast("이미지 파일만 첨부할 수 있어요");
        continue;
      }
      if (file.size > MAX_REF_MB * 1024 * 1024) {
        showToast(`연출컷은 장당 ${MAX_REF_MB}MB 이하예요`);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setScenes((prev) => [...prev, dataUrl]);
      } catch {
        showToast("이미지를 읽지 못했어요");
      }
    }
  };

  const handleSetLogo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 첨부할 수 있어요");
      return;
    }
    if (file.size > MAX_REF_MB * 1024 * 1024) {
      showToast(`로고는 ${MAX_REF_MB}MB 이하예요`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogo(dataUrl);
    } catch {
      showToast("이미지를 읽지 못했어요");
    }
  };

  const handleGenerateFromBrief = () => {
    if (!state.headline?.trim()) {
      showToast("카피를 먼저 만들어 주세요");
      return;
    }
    if (scenes.length === 0 && !logo && selectedMaterials.length === 0) {
      showToast("연출컷·로고·자료를 최소 1개 올려주세요");
      return;
    }
    const targets = computeBriefTargets(state.generatedImages);
    if (targets.length === 0) {
      showToast("모든 슬롯이 차 있어요. 먼저 삭제하거나 다시 생성해주세요");
      return;
    }
    const { sceneRefs, txtText } = buildBriefRefs({ scenes, logo, materials: selectedMaterials });

    const p = buildBriefPrompt({
      headline: state.headline,
      primaryText: state.primaryText,
      tone: state.tone,
      outcomeChip: state.outcome ?? null,
      scenesCount: scenes.length,
      hasLogo: !!logo,
      aspect,
      notes: briefNotes,
      refMaterialNames: selectedMaterials.map((m) => m.name),
    });
    const prompt = txtText ? `${p}\n\n${txtText}` : p;
    // brief 의 연출컷·자료는 전 variant 공통(variant 전용 ref)으로. 동일 prompt 3복제.
    runGenerate(
      targets,
      targets.map(() => ({ prompt, referenceImages: sceneRefs.length ? sceneRefs : undefined })),
    );
  };

  const handleUploadMaterial = async (files: FileList | null) => {
    if (!files || !activeBrandProfileId) return;
    for (const file of Array.from(files)) {
      try {
        const material = await uploadMaterial(file);
        setSelectedMaterials((prev) => [...prev, material]);
        showToast(`"${file.name}" 추가됐어요`);
      } catch (e) {
        showToast((e as Error).message ?? "업로드에 실패했어요");
      }
    }
  };

  const slotImage = (i: number) => {
    const src = allSlots?.[i] ?? "";
    if (pendingSlots.includes(i)) {
      return <Skeleton style={{ aspectRatio: "1 / 1", borderRadius: 8 }} />;
    }
    if (src) {
      return (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-pressed={selectedIdx === i}
            onClick={() => setImageDataUrl(src)}
            style={{ padding: 0, border: selectedIdx === i ? "2px solid var(--w-primary-normal)" : "1px solid var(--w-line-normal)", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none", lineHeight: 0, width: "100%", display: "block" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`생성 이미지 ${i + 1}`} style={{ width: "100%", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }} />
          </button>
          <button
            type="button"
            aria-label={`생성 이미지 ${i + 1} 크게 보기`}
            title="크게 보기"
            onClick={() => setZoomedSrc(src)}
            style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "rgba(255,255,255,0.94)", color: "var(--w-fg-normal)", display: "grid", placeItems: "center", cursor: "zoom-in", padding: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`생성 이미지 ${i + 1} 삭제`}
            title="삭제"
            onClick={() => handleRemoveImage(i)}
            style={{ position: "absolute", top: 6, left: 6, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "rgba(255,255,255,0.94)", color: "var(--w-fg-normal)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
          >
            <Icon name="x" size={13} />
          </button>
          {selectedIdx === i && (
            <span style={{ position: "absolute", bottom: 6, left: 6, padding: "2px 7px", borderRadius: 6, background: "var(--w-primary-normal)", color: "#fff", font: "600 10.5px/1 var(--w-font-sans)" }}>
              최종 선택
            </span>
          )}
        </div>
      );
    }
    return (
      <div style={{ aspectRatio: "1 / 1", borderRadius: 8, border: "1.5px dashed var(--w-line-normal)", background: "var(--w-bg-alternative)", display: "grid", placeItems: "center", color: "var(--w-fg-alternative)" }}>
        <Icon name="image" size={22} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" style={{ marginBottom: 18, paddingTop: 4 }}>
      <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">
        AI 이미지 생성 <Badge kind="neutral">실험</Badge>
      </label>

      <div
        className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]"
        role="tablist"
        aria-label="AI 이미지 생성 방식"
        style={{ marginBottom: 10 }}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] font-semibold text-[12.5px] leading-none transition-[background,color] duration-[120ms] cursor-pointer",
            mode === "concept"
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-sm"
              : "text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]",
          )}
          onClick={() => setMode("concept")}
          role="tab"
          aria-selected={mode === "concept"}
        >
          <Icon name="sparkles" size={13} /> 카피 기반 3컨셉
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] font-semibold text-[12.5px] leading-none transition-[background,color] duration-[120ms] cursor-pointer",
            mode === "brief"
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-sm"
              : "text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]",
          )}
          onClick={() => setMode("brief")}
          role="tab"
          aria-selected={mode === "brief"}
        >
          <Icon name="doc" size={13} /> 기획안·자료로 생성
        </button>
      </div>

      {/* Package Reference — 두 탭 공통 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]" style={{ marginBottom: 12 }}>
        {packageRef ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={packageRef.preview}
              alt="제품 레퍼런스"
              onClick={() => setZoomedSrc(packageRef.preview)}
              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--w-line-normal)", cursor: "zoom-in", flex: "none", opacity: packageRefOn ? 1 : 0.4 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-semibold text-[12.5px] leading-tight text-[var(--w-fg-strong)]">제품 레퍼런스 {packageRefOn ? "적용 중" : "꺼짐"}</div>
              <div className="font-medium text-[11.5px] leading-snug text-[var(--w-fg-neutral)] mt-0.5">제품 원본(라벨·로고)은 그대로 두고 배경만 컨셉별로 만들어요</div>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={() => setPackageRefOn((v) => !v)} className="border border-[var(--w-line-normal)]">
              {packageRefOn ? "끄기" : "켜기"}
            </Button>
            <label className={cn("inline-flex items-center justify-center gap-[5px] border font-semibold leading-none whitespace-nowrap h-8 px-3 text-[12.5px] rounded-lg", "bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] cursor-pointer transition-[background] duration-[120ms]")}>
              <Icon name="upload" size={13} /> 교체
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplacePackageRef(e.target.files)} />
            </label>
          </>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <div className="font-semibold text-[12.5px] leading-tight text-[var(--w-fg-strong)]">제품 레퍼런스 (선택)</div>
              <div className="font-medium text-[11.5px] leading-snug text-[var(--w-fg-neutral)] mt-0.5">제품 사진을 올리면 원본 그대로 두고 배경 연출만 생성해요</div>
            </div>
            <label className={cn("inline-flex items-center justify-center gap-[5px] border font-semibold leading-none whitespace-nowrap h-8 px-3 text-[12.5px] rounded-lg", "bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] cursor-pointer transition-[background] duration-[120ms]")}>
              <Icon name="upload" size={13} /> 제품 사진 첨부
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplacePackageRef(e.target.files)} />
            </label>
          </>
        )}
      </div>

      {mode === "concept" ? (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <Button
              variant="ghost"
              size="sm"
              disabled={suggest.isPending || !state.primaryText}
              onClick={handleSuggestConcepts}
              className="border border-[var(--w-line-normal)]"
            >
              <Icon name="sparkles" size={13} /> {suggest.isPending ? "컨셉 제안 중…" : "AI 컨셉 제안받기"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pendingSlots.length > 0 || ![0, 1, 2].some(conceptRenderable)}
              onClick={generateAllConcepts}
              style={{ marginLeft: "auto" }}
            >
              {pendingSlots.length > 0 ? "생성 중…" : "3컷 모두 생성"}
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={`concept-${i}`} className="flex flex-col gap-2 p-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 font-[600] text-[11px] leading-tight text-[var(--w-fg-neutral)] tracking-[0.03em] uppercase">
                    {concepts[i]?.label?.trim() || `컨셉 ${i + 1}`}
                  </div>
                  <button
                    type="button"
                    aria-label={`컨셉 ${i + 1} 프롬프트만 다시 제안`}
                    title="이 컨셉 프롬프트만 다시 제안"
                    disabled={rerollingSlots.includes(i) || !state.primaryText}
                    onClick={() => handleRerollConcept(i)}
                    className="flex-none grid place-items-center w-6 h-6 rounded-md border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] disabled:opacity-40 disabled:cursor-not-allowed transition-[background,color] duration-[120ms]"
                  >
                    <Icon name="refresh" size={12} spin={rerollingSlots.includes(i)} />
                  </button>
                </div>
                <textarea
                  className="w-full px-2.5 py-2 border border-[var(--w-line-normal)] rounded-lg bg-[var(--w-bg-elevated)] font-medium text-[12px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] resize-y"
                  aria-label={`컨셉 ${i + 1} 프롬프트`}
                  placeholder="AI 컨셉을 제안받거나 직접 입력하세요 (영어 권장)"
                  rows={3}
                  value={concepts[i]?.prompt ?? ""}
                  onChange={(e) =>
                    setConcepts((prev) => prev.map((c, idx) => (idx === i ? { ...c, prompt: e.target.value } : c)))
                  }
                />
                {slotImage(i)}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={pendingSlots.includes(i) || !conceptRenderable(i)}
                  onClick={() => generateConceptSlot(i)}
                  className="border border-[var(--w-line-normal)] w-full"
                >
                  {pendingSlots.includes(i) ? (
                    "생성 중…"
                  ) : allSlots?.[i] ? (
                    <>
                      <Icon name="refresh" size={13} /> 다시 생성
                    </>
                  ) : (
                    "이 컷 생성"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <BriefForm
          state={state}
          scenes={scenes}
          logo={logo}
          aspect={aspect}
          briefNotes={briefNotes}
          generating={pendingSlots.length > 0}
          warehouseMaterials={warehouseMaterials}
          selectedMaterials={selectedMaterials}
          onAddScenes={handleAddScenes}
          onRemoveScene={(i) => setScenes((prev) => prev.filter((_, idx) => idx !== i))}
          onClearScenes={() => setScenes([])}
          onSetLogo={handleSetLogo}
          onRemoveLogo={() => setLogo(null)}
          onAspectChange={setAspect}
          onNotesChange={setBriefNotes}
          onGenerate={handleGenerateFromBrief}
          onZoom={setZoomedSrc}
          onToggleMaterial={(m) =>
            setSelectedMaterials((prev) =>
              prev.find((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [...prev, m],
            )
          }
          onUploadMaterial={handleUploadMaterial}
        />
      )}

      {/* brief 모드의 생성 결과 슬롯 (concept 모드는 카드에 인라인) */}
      {mode === "brief" && (allSlots !== null || pendingSlots.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={`brief-slot-${i}`}>{slotImage(i)}</div>
          ))}
        </div>
      )}

      {filledCount > 0 && (
        <p style={{ font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "10px 0 0" }}>
          마음에 드는 1장을 골라주세요 (최종 광고 이미지). AI가 만든 이미지예요 — 정책·저작권·초상권은 직접 확인해주세요.
        </p>
      )}

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
    </div>
  );
}
