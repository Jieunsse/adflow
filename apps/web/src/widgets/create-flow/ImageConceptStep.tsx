"use client";

// 시안 2a — 이미지 3컷. 카피와 같은 스프레드 규칙으로 비교·선택한다.
// 컨셉 제안(/api/suggest-image-concepts) → 3컷 생성(/api/generate-image-stream) 은 기존 경로 그대로 쓴다.
// 제품을 골랐으면 그 제품 사진을 레퍼런스로 넘겨 원본 형태를 지킨다(ADR-041 Product Staging).
// 둘러보기 모드는 둘 다 부르지 않는다 — browse-images.ts 의 예시 컷을 그대로 채운다(ADR-033).

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { useProducts } from "@shared/lib/products";
import { useCreativeDraft } from "@entities/creative/model";
import type { ImageConcept, SuggestImageConceptsParams, SuggestImageConceptsResult } from "@/lib/gemini-creative";
import type { ImageVariant, ReferenceImage } from "@/lib/gemini-image";
import { fetchImageStream } from "@features/generate-image/image-stream";
import { readFileAsDataUrl, urlToRef } from "@features/generate-image/refs";
import { readActiveBrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import { PanelCard, SelectChip, StepHeaderBar, VerLabel, selectionRing } from "./parts";
import TextOverlayEditor from "./TextOverlayEditor";
import { BROWSE_CONCEPT_MS, BROWSE_IMAGE_STEP_MS, pickBrowseShots, type BrowseShot } from "./browse-images";

const CONCEPT_LETTER = ["A", "B", "C"] as const;
const EMPTY_CONCEPTS: ImageConcept[] = [
  { label: "", prompt: "" },
  { label: "", prompt: "" },
  { label: "", prompt: "" },
];

// 분위기 칩 → 생성 프롬프트에 덧붙는 영어 연출 지시. 칩이 실제로 그림을 바꾸게 하는 유일한 연결점.
const MOODS = [
  { id: "fresh", label: "청량한", suffix: "cool, airy, high-key lighting, crisp blue-white palette" },
  { id: "warm", label: "따뜻한", suffix: "warm golden-hour light, soft shadows, cozy amber palette" },
  { id: "minimal", label: "미니멀", suffix: "minimal composition, lots of negative space, muted neutral palette" },
  { id: "vivid", label: "비비드", suffix: "vivid saturated colors, bold contrast, punchy commercial look" },
] as const;

type MoodId = (typeof MOODS)[number]["id"];

interface Props {
  savedLabel: string | null;
  productId: string | null;
  selectedVerIdx: number;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
  finalImageDataUrl: string | null;
  setFinalImageDataUrl: (v: string | null) => void;
  onBackToCompare: () => void;
  onNext: () => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function ImageConceptStep(p: Props) {
  const { state, dispatch } = useCreativeDraft();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const showToast = useToast();
  const activeBrandProfileId = readActiveBrandProfileEntry()?.id ?? "";
  const { products } = useProducts(activeBrandProfileId);
  const [concepts, setConcepts] = useState<ImageConcept[]>(EMPTY_CONCEPTS);
  // 카드 설명 줄. 둘러보기는 손으로 적은 한국어 설명을 쓰고, 실제 경로는 비어 있어 프롬프트로 폴백한다.
  const [notes, setNotes] = useState<string[]>([]);
  const [mood, setMood] = useState<MoodId>("fresh");
  const [suggesting, setSuggesting] = useState(false);
  const [pending, setPending] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  // url 을 키로 들고 있다가 렌더에서 파생시킨다 — 제품이 바뀐 순간 옛 레퍼런스가 딸려가지 않게.
  const [refCache, setRefCache] = useState<{ url: string; ref: ReferenceImage } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const autoRanRef = useRef(false);

  const images = state.generatedImages;
  const product = products.find((pr) => pr.id === p.productId);

  const productImageUrl = product?.imageUrl;
  const productRef = productImageUrl && refCache?.url === productImageUrl ? refCache.ref : null;

  // 제품 사진 → 레퍼런스. 있으면 Product Staging(배경만 변주) 으로 흐른다.
  useEffect(() => {
    if (!productImageUrl) return;
    let cancelled = false;
    urlToRef(productImageUrl).then((result) => {
      if (!cancelled && result) setRefCache({ url: productImageUrl, ref: result.ref });
    });
    return () => { cancelled = true; };
  }, [productImageUrl]);

  const runGenerate = async (cs: ImageConcept[], moodId: MoodId) => {
    const suffix = MOODS.find((m) => m.id === moodId)?.suffix ?? "";
    const staging = !!productRef;
    const targets = [0, 1, 2].filter((i) => !!cs[i]?.prompt.trim() || staging);
    if (targets.length === 0) {
      showToast("컨셉을 먼저 제안받아 주세요");
      return;
    }
    setPending(targets);
    setFailed(false);
    const cur = state.generatedImages ?? ["", "", ""];
    const working: [string, string, string] = [cur[0], cur[1], cur[2]];

    const variants: ImageVariant[] = targets.map((i) => ({
      prompt: [cs[i]?.prompt ?? "", suffix].filter(Boolean).join(", "),
    }));
    try {
      await fetchImageStream(
        {
          variants,
          referenceImages: productRef ? [productRef] : undefined,
          preserveReference: staging,
        },
        (serverIdx, image) => {
          const slot = targets[serverIdx];
          if (slot === undefined) return;
          working[slot] = image;
          dispatch({ type: "SET_GENERATED_IMAGES", images: [working[0], working[1], working[2]] });
        },
      );
      if (targets.every((i) => !working[i])) {
        setFailed(true);
        showToast("이미지가 생성되지 않았어요, 다시 시도해주세요");
      }
    } catch (err) {
      console.error("[create-flow/image]", err);
      setFailed(true);
      showToast("이미지 생성에 실패했어요, 다시 시도해주세요");
    } finally {
      setPending([]);
    }
  };

  // 둘러보기 전용 — 컨셉도 이미지도 부르지 않고 시드를 한 장씩 꽂는다.
  const fillBrowseShots = async (shots: BrowseShot[]) => {
    setSuggesting(true);
    setFailed(false);
    await wait(BROWSE_CONCEPT_MS);
    setConcepts(shots.map((sh) => ({ label: sh.label, prompt: "" })));
    setNotes(shots.map((sh) => sh.note));
    dispatch({ type: "SET_OVERLAY_HEADLINES", headlines: null });
    setSuggesting(false);

    setPending([0, 1, 2]);
    const working: [string, string, string] = ["", "", ""];
    for (const [i, shot] of shots.entries()) {
      await wait(BROWSE_IMAGE_STEP_MS);
      working[i] = shot.url;
      dispatch({ type: "SET_GENERATED_IMAGES", images: [working[0], working[1], working[2]] });
    }
    setPending([]);
  };

  // react-query 대신 맨 fetch — 이 호출은 마운트 직후 effect 에서 나간다.
  // StrictMode 가 흉내내는 언마운트→재마운트에서 useMutation 옵저버가 새로 만들어지면서
  // 날아간 요청의 onSuccess 가 통째로 유실됐다(3컷이 영영 "잡는 중"에 머물던 원인).
  const suggestAndGenerate = async (moodId: MoodId = mood) => {
    if (!browseMode && !state.primaryText?.trim()) {
      showToast("카피를 먼저 골라주세요");
      return;
    }
    if (browseMode) {
      const rotate = MOODS.findIndex((m) => m.id === moodId);
      await fillBrowseShots(pickBrowseShots(product?.imageUrl, rotate < 0 ? 0 : rotate));
      return;
    }
    const params: SuggestImageConceptsParams = {
      headline: state.headline,
      primaryText: state.primaryText,
      tone: state.tone,
      productName: product?.name || undefined,
      productDescription: product?.description || undefined,
      outcome: state.outcome ?? undefined,
      stageProduct: !!productRef,
    };
    setSuggesting(true);
    setFailed(false);
    try {
      const res = await fetch("/api/suggest-image-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`컨셉 제안 실패 (${res.status})`);
      const data = (await res.json()) as SuggestImageConceptsResult;
      const fresh = data.concepts.slice(0, 3);
      setConcepts(fresh);
      dispatch({
        type: "SET_OVERLAY_HEADLINES",
        headlines: data.overlayHeadlines?.length ? data.overlayHeadlines : null,
      });
      await runGenerate(fresh, moodId);
    } catch (err) {
      console.error("[create-flow/concepts]", err);
      setFailed(true);
      showToast("컨셉 제안에 실패했어요, 다시 시도해주세요");
    } finally {
      setSuggesting(false);
    }
  };

  // 처음 들어왔는데 아직 만든 컷이 없으면 알아서 한 번 굴린다 — 빈 화면을 보여주지 않으려고.
  useEffect(() => {
    if (autoRanRef.current) return;
    if (images?.some(Boolean)) return;
    if (!browseMode && !state.primaryText?.trim()) return;
    autoRanRef.current = true;
    // 첫 페인트 뒤로 미룬다 — 이펙트 안에서 곧바로 setState 하면 렌더가 한 번 더 돈다.
    // cleanup 에서 플래그를 되돌리므로 StrictMode 의 가짜 언마운트에도 정확히 한 번만 발사된다.
    const timer = setTimeout(() => { void suggestAndGenerate(); }, 0);
    return () => {
      clearTimeout(timer);
      autoRanRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.primaryText, browseMode]);

  // 베이스 컷이 바뀌면 위에 구워 둔 텍스트는 무효 — 이중 인쇄 방지.
  const pick = (src: string) => {
    if (src !== p.imageDataUrl) p.setFinalImageDataUrl(null);
    p.setImageDataUrl(src);
  };

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 올릴 수 있어요");
      return;
    }
    try {
      pick(await readFileAsDataUrl(file));
    } catch {
      showToast("이미지를 읽지 못했어요");
    }
  };

  const busy = suggesting || pending.length > 0;

  return (
    <div className="bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] overflow-hidden">
      <StepHeaderBar title="이미지 3컷 비교" savedLabel={p.savedLabel}>
        <Button variant="ghost" size="sm" type="button" onClick={p.onNext}>
          이미지 없이 진행
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={p.onNext} disabled={!p.imageDataUrl}>
          이 컷으로 다듬기 →
        </Button>
      </StepHeaderBar>

      <div className="flex items-start gap-5 px-6 py-5">
        <PanelCard className="w-[232px] shrink-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--w-line-alternative)] font-bold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">
            확정한 카피
          </div>
          <div className="px-4 py-3.5 border-b border-[var(--w-line-alternative)]">
            <div className="flex items-center gap-1.5 mb-2">
              <VerLabel index={p.selectedVerIdx} hook={null} />
            </div>
            <div className="font-semibold text-[14px] leading-[1.5] text-[var(--w-fg-strong)] mb-1.5">
              {state.headline}
            </div>
            <div className="font-normal text-[12px] leading-[1.6] text-[var(--w-fg-neutral)] line-clamp-4">
              {state.primaryText}
            </div>
            <button
              type="button"
              onClick={p.onBackToCompare}
              className="mt-2.5 font-medium text-[12px] leading-[1.4] text-[var(--w-primary-normal)] cursor-pointer"
            >
              카피 다시 고르기 ›
            </button>
          </div>
          <div className="px-4 py-3.5">
            <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] mb-2">이미지 분위기</div>
            <div className="flex gap-1.5 flex-wrap">
              {MOODS.map((m) => (
                <SelectChip
                  key={m.id}
                  chipSize="sm"
                  active={mood === m.id}
                  disabled={busy}
                  onClick={() => setMood(m.id)}
                >
                  {m.label}
                </SelectChip>
              ))}
            </div>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                block
                type="button"
                disabled={busy}
                onClick={() => void suggestAndGenerate(mood)}
              >
                <Icon name="sparkles" size={13} /> 3컷 다시 만들기
              </Button>
            </div>
            <p className="m-0 mt-2 text-center font-normal text-[11px] leading-[1.5] text-[var(--w-fg-neutral)]">
              {browseMode ? "둘러보기 모드라 예시 이미지를 보여드려요" : `약 15초 소요${productRef ? " · 제품 원본 유지" : ""}`}
            </p>
          </div>
        </PanelCard>

        <div className="flex-1 min-w-0 flex gap-3.5">
          {[0, 1, 2].map((i) => {
            const src = images?.[i] || "";
            const selected = !!src && p.imageDataUrl === src;
            const loading = pending.includes(i) || suggesting;
            return (
              <div
                key={i}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => src && pick(src)}
                onKeyDown={(e) => {
                  if (src && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    pick(src);
                  }
                }}
                className="flex-1 min-w-0 bg-[var(--w-bg-normal)] rounded-[var(--w-radius-16)] p-3 cursor-pointer transition-[box-shadow] duration-150"
                style={{ boxShadow: selectionRing(selected) }}
              >
                <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
                  <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">
                    컨셉 {CONCEPT_LETTER[i]}
                  </span>
                  <span className="font-normal text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] truncate">
                    {concepts[i]?.label || (loading ? "컨셉 잡는 중…" : "—")}
                  </span>
                  <span className="flex-1" />
                  {selected && (
                    <span className="font-semibold text-[11px] leading-[1.3] text-[var(--w-primary-normal)] shrink-0">
                      ● 선택됨
                    </span>
                  )}
                </div>

                {loading ? (
                  <Skeleton className="h-[300px] rounded-[var(--w-radius-12)]" />
                ) : src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`컨셉 ${CONCEPT_LETTER[i]} 이미지`}
                    className="w-full h-[300px] object-cover rounded-[var(--w-radius-12)] block"
                  />
                ) : (
                  <div className="w-img-placeholder h-[300px] rounded-[var(--w-radius-12)] flex items-end p-3">
                    <span className="px-[9px] py-[5px] rounded-[var(--w-radius-6)] bg-[var(--w-surface-narrative)] text-[var(--w-on-narrative)] font-medium text-[11px] leading-[1.3]">
                      {failed ? "생성 실패" : "아직 없어요"}
                    </span>
                  </div>
                )}

                <div className="font-normal text-[12px] leading-[1.6] text-[var(--w-fg-neutral)] mt-2.5 px-0.5 line-clamp-2">
                  {notes[i] || concepts[i]?.prompt || "‘3컷 다시 만들기’로 컨셉을 제안받을 수 있어요."}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mx-6 mb-5 px-4 py-3.5 bg-[var(--w-bg-normal)] rounded-[var(--w-radius-12)] shadow-[var(--w-shadow-card)]">
        <p className="m-0 font-normal text-[12px] leading-[1.6] text-[var(--w-fg-neutral)]">
          AI가 만든 이미지예요 — 상표·저작권·초상권은 게재 전 직접 확인해주세요. 사람 얼굴이 필요한 경우 직접 촬영본을 올리는 편이 안전해요.
        </p>
        <div className="flex gap-2 shrink-0">
          {p.imageDataUrl && (
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditing(true)}>
              <Icon name="edit" size={13} /> 텍스트 편집
            </Button>
          )}
          <Button variant="secondary" size="sm" type="button" onClick={() => uploadRef.current?.click()}>
            내 이미지 올리기
          </Button>
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void handleUpload(e.target.files); e.target.value = ""; }}
        />
      </div>

      {editing && p.imageDataUrl && (
        <TextOverlayEditor
          baseImageUrl={p.imageDataUrl}
          headlineSuggestion={state.headline}
          subtitleSuggestion={state.subtitle || undefined}
          overlayHeadlines={state.overlayHeadlines ?? undefined}
          onClose={() => setEditing(false)}
          onSave={(final) => p.setFinalImageDataUrl(final)}
        />
      )}
    </div>
  );
}
