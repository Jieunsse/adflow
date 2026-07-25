"use client";

// ADR-040 — 소재 만들기 phase 2 본체. "고를 땐(설정) 묶고, 결과는 따로":
//  · GenSetupCard: 방식 2택(concept/brief) + 종속 슬롯(제품 레퍼런스 / 참고 자료). 생성 CTA 없음.
//  · 진입/결과: 빈상태=히어로(CTA 소유) / GEN=쉬머+스피너 / B=3컷 그리드(1장 선택·비선택 dim).
// Package Reference: 선택 Product imageUrl 자동 + 수동 교체. 전 variant 공통 referenceImages 로 합류.

import { useEffect, useRef, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
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
import { useProducts } from "@shared/lib/products";
import BriefForm, { type AspectId } from "./BriefForm";
import GenSetupCard from "./GenSetupCard";
import ImageEntryHero from "./ImageEntryHero";

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
  finalImageDataUrl,
  setImageDataUrl,
}: {
  productId: string | null;
  imageDataUrl: string | null;
  finalImageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
}) {
  const { state, dispatch } = useCreativeDraft();
  const showToast = useToast();
  const [mode, setMode] = useState<AiImageMode>("concept");
  const briefHeadingRef = useRef<HTMLHeadingElement>(null);
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);
  const [pendingSlots, setPendingSlots] = useState<number[]>([]);
  const [rerollingSlots, setRerollingSlots] = useState<number[]>([]);
  const [promptEditSlots, setPromptEditSlots] = useState<number[]>([]);
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
  const { products } = useProducts(activeBrandProfileId);

  // 선택된 Product 의 imageUrl → Package Reference 자동 제안. name·description → 컨셉 grounding.
  useEffect(() => {
    if (!productId || !activeBrandProfileId) {
      setProductMeta(null);
      return;
    }
    const product = products.find((pr) => pr.id === productId);
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
  }, [productId, activeBrandProfileId, products]);

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
        onSuccess: (data) => {
          const fresh = data.concepts.slice(0, 3);
          setConcepts(fresh);
          dispatch({ type: "SET_OVERLAY_HEADLINES", headlines: data.overlayHeadlines?.length ? data.overlayHeadlines : null });
          runConcepts(fresh); // 제안 직후 바로 3컷 생성 — 보고 나서 유저가 바꾸는 흐름
        },
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

  // 주어진 컨셉 배열로 렌더 가능한 슬롯을 모두 생성. setConcepts 직후 stale state 를 피하려 인자로 받는다.
  const runConcepts = (cs: ImageConcept[]) => {
    const targets = [0, 1, 2].filter((i) => !!cs[i]?.prompt.trim() || (packageRefOn && !!packageRef));
    if (targets.length === 0) {
      showToast("AI 컨셉을 먼저 제안받거나 프롬프트를 입력해주세요");
      return;
    }
    runGenerate(targets, targets.map((i) => ({ prompt: cs[i]?.prompt ?? "" })), stagingActive);
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
      imageGuide: readActiveBrandProfileEntry()?.imageGuide,
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
      // GEN — 쉬머(Skeleton) 위에 스피너·라벨·진행 인디케이터(빈 화면 금지)
      return (
        <div style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden" }}>
          <Skeleton className="absolute inset-0 !rounded-none" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-2.5">
              <div className="rounded-full border-[2.6px] border-[var(--w-accent-violet-soft)] border-t-[var(--w-accent-violet)] animate-[spin_0.85s_linear_infinite]" style={{ width: 26, height: 26 }} />
              <div className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)] whitespace-nowrap">
                {concepts[i]?.label?.trim() || `컨셉 ${i + 1}`} 만드는 중…
              </div>
              <div className="h-1 rounded-full overflow-hidden bg-[var(--w-line-neutral)]" style={{ width: "64%" }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: "60%", background: "linear-gradient(90deg, var(--w-primary-normal), var(--w-accent-violet))" }} />
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (src) {
      const selected = selectedIdx === i;
      const dim = selectedIdx >= 0 && !selected;
      const displaySrc = selected && finalImageDataUrl ? finalImageDataUrl : src;
      return (
        <div className="group" style={{ position: "relative", opacity: dim ? 0.78 : 1, transition: "opacity 160ms ease" }}>
          <button
            type="button"
            aria-pressed={selected}
            aria-label={`이미지 ${i + 1} 최종 선택`}
            onClick={() => setImageDataUrl(src)}
            style={{ padding: 0, border: selected ? "2px solid var(--w-primary-normal)" : "1px solid var(--w-line-normal)", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none", lineHeight: 0, width: "100%", display: "block", boxShadow: selected ? "0 0 0 4px rgba(0,102,255,0.16)" : "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displaySrc} alt={`생성 이미지 ${i + 1}`} style={{ width: "100%", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }} />
          </button>
          {/* 선택 affordance — 항상 노출(라디오). 클릭 영역은 이미지 표면 */}
          <span
            aria-hidden="true"
            style={{ position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: selected ? "var(--w-primary-normal)" : "rgba(255,255,255,0.94)", border: selected ? "none" : "1.5px solid var(--w-line-normal)", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", pointerEvents: "none" }}
          >
            {selected && <Icon name="check" size={13} />}
          </span>
          {/* 보조 액션 — hover 시에만(선택 표면과 분리, 데스크탑 전용) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
            <button
              type="button"
              aria-label={`생성 이미지 ${i + 1} 크게 보기`}
              title="크게 보기"
              onClick={() => setZoomedSrc(displaySrc)}
              style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "rgba(255,255,255,0.94)", color: "var(--w-fg-normal)", display: "grid", placeItems: "center", cursor: "zoom-in", padding: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={`생성 이미지 ${i + 1} 비우기`}
              title="비우기"
              onClick={() => handleRemoveImage(i)}
              style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "rgba(255,255,255,0.94)", color: "var(--w-fg-normal)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
          {selected && (
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

  // ── 종속 슬롯: 참조할 제품(concept) — packageRef 3상태 보존(켜짐/꺼짐/미첨부) ──
  const productSlot = (
    <div className="py-3">
      <span className="block w-overline text-[var(--w-fg-alternative)] mb-2.5">참조할 제품</span>
      {packageRef && packageRefOn ? (
        <div className="flex items-start gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={packageRef.preview}
            alt={productMeta?.name ?? "제품 사진"}
            title="클릭하면 크게 볼 수 있어요"
            onClick={() => setZoomedSrc(packageRef.preview)}
            style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: "1px solid var(--w-line-normal)", cursor: "zoom-in", flex: "none" }}
          />
          <div className="flex-1 min-w-0 flex flex-col items-start">
            <span className="inline-flex items-center gap-1.5 px-[7px] py-[2px] rounded-md font-semibold text-[11px] leading-none text-[var(--w-fg-strong)]" style={{ background: "var(--w-status-positive-soft)" }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--w-status-positive)", flex: "none" }} aria-hidden="true" />
              원본 유지 중
            </span>
            <div className="w-label truncate w-full mt-1.5" title={productMeta?.name}>{productMeta?.name ?? "선택한 제품"}</div>
            <div className="flex items-center gap-1.5 w-caption mt-1">
              라벨·로고 그대로, 배경만 AI가 만들어요
              <span className="inline-grid place-items-center text-[var(--w-fg-alternative)]" title="제품 원본(라벨·로고)은 그대로 두고 배경만 컨셉별로 만들어요">
                <Icon name="info" size={13} />
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              <label className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[13px] leading-none px-3 py-2 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-primary-press)] hover:bg-[var(--w-primary-soft)] hover:border-[var(--w-primary-normal)] cursor-pointer transition-[background,border-color] duration-[120ms]">
                <Icon name="upload" size={13} /> 다른 사진 올리기
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplacePackageRef(e.target.files)} />
              </label>
              <button type="button" onClick={() => setPackageRefOn(false)} className="font-semibold text-[13px] leading-none px-3 py-2 rounded-lg text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] cursor-pointer transition-[background,color] duration-[120ms]">
                끄기
              </button>
            </div>
          </div>
        </div>
      ) : packageRef && !packageRefOn ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--w-status-cautionary-line)] bg-[var(--w-status-cautionary-soft)]">
          <Icon name="warn" size={16} className="text-[var(--w-status-cautionary)] flex-none" />
          <div className="min-w-0" style={{ flex: 1 }}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-label truncate" title={productMeta?.name}>{productMeta?.name ?? "선택한 제품"}</span>
              <span className="inline-flex items-center gap-1.5 px-[7px] py-[2px] rounded-md font-semibold text-[11px] leading-none text-[var(--w-fg-strong)] flex-none" style={{ background: "var(--w-status-cautionary-soft)" }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--w-status-cautionary)", flex: "none" }} aria-hidden="true" />
                AI 재해석됨
              </span>
            </div>
            <div className="w-caption mt-0.5">라벨·로고 유지 안 됨 — 배경과 함께 재생성</div>
          </div>
          <label className="inline-flex items-center justify-center gap-1.5 border font-semibold leading-none whitespace-nowrap h-8 px-3 text-[13px] rounded-lg bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] cursor-pointer transition-[background] duration-[120ms]">
            <Icon name="upload" size={13} /> 사진 바꾸기
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplacePackageRef(e.target.files)} />
          </label>
          <Button variant="secondary" size="sm" type="button" onClick={() => setPackageRefOn(true)}>
            켜기
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)]">
          <div className="min-w-0" style={{ flex: 1 }}>
            <div className="w-label truncate" title={productMeta?.name}>{productMeta?.name ? `${productMeta.name} · 사진 없음` : "제품 레퍼런스 (선택)"}</div>
            <div className="w-caption mt-0.5">{productMeta?.name ? "사진을 올리면 이 제품 원본을 그대로 둬요" : "제품 사진을 올리면 원본 그대로 두고 배경 연출만 생성해요"}</div>
          </div>
          <label className="inline-flex items-center justify-center gap-1.5 border font-semibold leading-none whitespace-nowrap h-8 px-3 text-[13px] rounded-lg bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] cursor-pointer transition-[background] duration-[120ms]">
            <Icon name="upload" size={13} /> 제품 사진 첨부
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplacePackageRef(e.target.files)} />
          </label>
        </div>
      )}
    </div>
  );

  // ── 종속 슬롯: 참고 자료(brief) — 기존 BriefForm 기능 그대로 ──
  const docSlot = (
    <div className="py-3">
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
    </div>
  );

  // 진입/결과 표면: concept 모드에서 한 번도 생성·제안 안 했으면 빈상태(히어로).
  const conceptUntouched = !concepts.some((c) => !!c.prompt.trim()) && allSlots === null && pendingSlots.length === 0;
  const showGrid = mode === "concept" ? !conceptUntouched : allSlots !== null || pendingSlots.length > 0;
  const briefEntry = mode === "brief" && !showGrid;

  useEffect(() => {
    if (briefEntry) briefHeadingRef.current?.focus();
  }, [briefEntry]);

  const backToConceptLink = (
    <button
      type="button"
      onClick={() => setMode("concept")}
      className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[13px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] cursor-pointer transition-[color] duration-[120ms]"
    >
      <Icon name="sparkles" size={13} /> AI 컨셉으로
    </button>
  );

  return (
    <div className="flex flex-col gap-4" style={{ marginBottom: 18, paddingTop: 4 }}>
      {/* 임시로 숨김 — "어떻게 만들까요?" 카드
      <GenSetupCard mode={mode} onModeChange={setMode} productSlot={productSlot} docSlot={docSlot} /> */}

      {/* 진입/결과 — 빈상태 히어로(concept) / GEN·B 3컷 그리드 */}
      {mode === "concept" && conceptUntouched && (
        <ImageEntryHero
          generating={suggest.isPending || pendingSlots.length > 0}
          disabled={!state.primaryText}
          onGenerate={handleSuggestConcepts}
          onDoc={() => setMode("brief")}
        />
      )}

      {mode === "concept" && !conceptUntouched && (
        <>
          {/* 전체 재제안 — 카드별 '다시 생성'이 있으니 조용한 ghost 보조로 강등 */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              disabled={suggest.isPending || pendingSlots.length > 0 || !state.primaryText}
              onClick={handleSuggestConcepts}
              className="inline-flex items-center gap-1 font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-[color] duration-[120ms]"
            >
              <Icon name="refresh" size={12} spin={suggest.isPending} />
              {suggest.isPending ? "컨셉 제안 중…" : pendingSlots.length > 0 ? "생성 중…" : "전체 다시 제안"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[0, 1, 2].map((i) => {
              const editing = promptEditSlots.includes(i);
              return (
                <div key={`concept-${i}`} className="flex flex-col bg-[var(--w-bg-elevated)] border-[1.5px] border-[var(--w-line-normal)] rounded-2xl overflow-hidden">
                  <div style={{ position: "relative" }}>
                    {slotImage(i)}
                    <span className="absolute right-3 bottom-3 z-[3] inline-flex items-center gap-[7px] whitespace-nowrap px-2.5 py-1.5 rounded-full text-white font-semibold text-[12px] leading-none" style={{ background: "rgba(23,23,25,0.62)", backdropFilter: "blur(6px)", pointerEvents: "none" }}>
                      <b className="font-bold">{concepts[i]?.label?.trim() || `컨셉 ${i + 1}`}</b>
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-expanded={editing}
                        onClick={() =>
                          setPromptEditSlots((prev) => (editing ? prev.filter((s) => s !== i) : [...prev, i]))
                        }
                        className="inline-flex items-center gap-1.5 font-medium text-[12px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] cursor-pointer transition-[color] duration-[120ms]"
                      >
                        <Icon name="chev-down" size={12} style={{ transform: editing ? "none" : "rotate(-90deg)", transition: "transform 120ms" }} />
                        프롬프트 편집
                      </button>
                      <button
                        type="button"
                        disabled={pendingSlots.includes(i) || !conceptRenderable(i)}
                        onClick={() => generateConceptSlot(i)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] rounded-lg px-2.5 py-1.5 font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-[background,color] duration-[120ms]"
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
                      </button>
                    </div>
                    {editing && (
                      <div className="bg-[var(--w-bg-alternative)] border border-[var(--w-line-alternative)] rounded-[10px] px-3 py-2.5">
                        <textarea
                          className="w-full border-none bg-transparent resize-y font-medium text-[12px] leading-[1.55] text-[var(--w-fg-neutral)] outline-none"
                          style={{ fontFamily: "var(--w-font-mono)", minHeight: 56 }}
                          aria-label={`컨셉 ${i + 1} 프롬프트`}
                          placeholder="AI 컨셉을 제안받거나 직접 입력하세요 (영어 권장)"
                          value={concepts[i]?.prompt ?? ""}
                          onChange={(e) =>
                            setConcepts((prev) => prev.map((c, idx) => (idx === i ? { ...c, prompt: e.target.value } : c)))
                          }
                        />
                        <button
                          type="button"
                          disabled={rerollingSlots.includes(i) || !state.primaryText}
                          onClick={() => handleRerollConcept(i)}
                          className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-[color] duration-[120ms]"
                        >
                          <Icon name="refresh" size={11} spin={rerollingSlots.includes(i)} /> 컨셉 다시 제안
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* brief 입력 단계 — 생성 전 BriefForm 표면(고아였던 docSlot 배선) */}
      {briefEntry && (
        <div className="rounded-[20px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-[7px] whitespace-nowrap font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-accent-violet)]">
                <Icon name="doc" size={13} /> 기획안·자료로 만들기
              </span>
              <h3 ref={briefHeadingRef} tabIndex={-1} className="font-bold text-[18px] leading-[1.35] tracking-[-0.016em] text-[var(--w-fg-strong)] mt-2 outline-none">
                가진 자료를 올리면 그대로 반영해 3컷을 만들어요
              </h3>
              <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1.5">
                연출컷·로고·참고 자료를 한 덩어리로 AI에 전달해요.
              </p>
            </div>
            {backToConceptLink}
          </div>
          {docSlot}
        </div>
      )}

      {/* brief 모드의 생성 결과 그리드 (설정 카드 슬롯의 생성 버튼이 트리거) */}
      {mode === "brief" && showGrid && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="w-overline text-[var(--w-fg-alternative)]">기획안으로 만든 3컷</span>
            {backToConceptLink}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={`brief-slot-${i}`}>{slotImage(i)}</div>
            ))}
          </div>
          <details className="rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-4 py-1">
            <summary className="py-2.5 font-semibold text-[13px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] cursor-pointer select-none">
              기획안 수정하고 다시 생성해요
            </summary>
            {docSlot}
          </details>
        </>
      )}

      {filledCount > 0 &&
        (selectedIdx >= 0 ? (
          <p className="flex items-center gap-1.5" style={{ font: "600 12.5px/1.4 var(--w-font-sans)", color: "var(--w-primary-normal)", margin: 0 }}>
            <Icon name="check-circle" size={14} />
            {(concepts[selectedIdx]?.label?.trim() || `컨셉 ${selectedIdx + 1}`)} 선택됨 — 이 이미지로 광고를 만들어요
          </p>
        ) : (
          <p style={{ font: "500 12.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: 0 }}>
            마음에 드는 1장을 클릭해 최종 광고 이미지로 골라주세요
          </p>
        ))}

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
