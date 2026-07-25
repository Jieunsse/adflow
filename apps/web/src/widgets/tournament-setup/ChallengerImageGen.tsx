"use client";

// A/B 토너먼트 셋업 — 이미지 축 챌린저(B) 생성. 소재 만들기(ADR-040/041)와 동일 로직:
//  AI 가 카피 기반 Image Concept 3개(다축 분기) 제안 → 슬롯별 prompt 편집·생성 → 한 장 골라 B 이미지로.
// Product Staging(ADR-041): 제품 원본(라벨·로고)을 그대로 보존하고 씬만 컨셉별로 만든다.
//   레퍼런스 = 제품 사진(없으면 챔피언 이미지). 같은 제품, 이미지만 바꾸는 게 A/B 규칙과 정합.
// 챔피언의 헤드라인·카피를 컨셉 grounding 에 주입한다.

import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/cn";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { fetchImageStream } from "@features/generate-image/stream";
import { readFileAsDataUrl, splitDataUrl, urlToRef } from "@features/generate-image/refs";
import type { ReferenceImage } from "@/lib/gemini-image";
import type {
  ImageConcept,
  SuggestImageConceptsParams,
  SuggestImageConceptsResult,
} from "@/lib/gemini-creative";

const MAX_REF_MB = 3;

const EMPTY_CONCEPTS: ImageConcept[] = [
  { label: "", prompt: "" },
  { label: "", prompt: "" },
  { label: "", prompt: "" },
];

export default function ChallengerImageGen({
  headline,
  primaryText,
  tone,
  outcome,
  productName,
  productDescription,
  referenceUrl,
  value,
  onChange,
}: {
  headline: string;
  primaryText: string;
  tone: string;
  outcome?: string;
  productName?: string;
  productDescription?: string;
  referenceUrl?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [concepts, setConcepts] = useState<ImageConcept[]>(EMPTY_CONCEPTS);
  const [images, setImages] = useState<[string, string, string]>(["", "", ""]);
  const [pending, setPending] = useState<number[]>([]);
  const [error, setError] = useState("");
  // Product Staging — 보존할 제품 레퍼런스(전 컨셉 공통).
  const [packageRef, setPackageRef] = useState<{ ref: ReferenceImage; preview: string } | null>(null);
  const [packageRefOn, setPackageRefOn] = useState(true);
  const suggest = useApiMutation<SuggestImageConceptsParams, SuggestImageConceptsResult>(
    "/api/suggest-image-concepts",
  );

  // 제품 사진(없으면 챔피언 이미지)을 보존 레퍼런스로 자동 제안.
  useEffect(() => {
    if (!referenceUrl) return;
    let cancelled = false;
    urlToRef(referenceUrl).then((res) => {
      if (!cancelled && res) {
        setPackageRef(res);
        setPackageRefOn(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [referenceUrl]);

  // 제품 보존 활성 = 레퍼런스가 켜져 있을 때. 켜져 있으면 씬만 생성(preserve), 꺼지면 프롬프트만으로 생성.
  const stagingActive = packageRefOn && !!packageRef;
  const commonRefs = (): ReferenceImage[] | undefined => (stagingActive ? [packageRef!.ref] : undefined);
  const renderable = (i: number) => !!concepts[i]?.prompt.trim() || stagingActive;

  const handleSuggest = () => {
    setError("");
    suggest.mutate(
      {
        headline,
        primaryText,
        tone,
        productName: productName || undefined,
        productDescription: productDescription || undefined,
        outcome,
        stageProduct: stagingActive,
      },
      {
        onSuccess: (data) => setConcepts(data.concepts.slice(0, 3)),
        onError: () => setError("컨셉 제안에 실패했어요. 다시 시도해주세요."),
      },
    );
  };

  const run = async (targets: number[]) => {
    if (targets.length === 0) return;
    setError("");
    setPending((prev) => Array.from(new Set([...prev, ...targets])));
    const working: [string, string, string] = [images[0], images[1], images[2]];
    try {
      await fetchImageStream(
        {
          variants: targets.map((i) => ({ prompt: concepts[i]?.prompt ?? "" })),
          referenceImages: commonRefs(),
          preserveReference: stagingActive,
        },
        (serverIdx, image) => {
          const slot = targets[serverIdx];
          if (slot !== undefined) {
            working[slot] = image;
            setImages([working[0], working[1], working[2]]);
          }
        },
      );
      if (targets.every((i) => !working[i])) setError("이미지가 생성되지 않았어요. 다시 시도해주세요.");
    } catch {
      setError("이미지 생성에 실패했어요. 다시 시도해주세요.");
    } finally {
      setPending((prev) => prev.filter((i) => !targets.includes(i)));
    }
  };

  const generateAll = () => {
    const targets = [0, 1, 2].filter(renderable);
    if (targets.length === 0) {
      setError("AI 컨셉을 먼저 제안받거나 프롬프트를 입력해주세요.");
      return;
    }
    run(targets);
  };

  const handleReplaceRef = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 첨부할 수 있어요.");
      return;
    }
    if (file.size > MAX_REF_MB * 1024 * 1024) {
      setError(`제품 레퍼런스는 ${MAX_REF_MB}MB 이하예요.`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const ref = splitDataUrl(dataUrl);
      if (ref) {
        setPackageRef({ ref, preview: dataUrl });
        setPackageRefOn(true);
        setError("");
      }
    } catch {
      setError("이미지를 읽지 못했어요.");
    }
  };

  const uploadBtnClass = cn(
    "inline-flex items-center justify-center gap-[5px] border font-semibold leading-none whitespace-nowrap h-8 px-3 text-[13px] rounded-lg",
    "bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] cursor-pointer transition-[background] duration-[120ms]",
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Product Staging — 보존할 제품 레퍼런스 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]">
        {packageRef ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={packageRef.preview}
              alt="제품 레퍼런스"
              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--w-line-normal)", flex: "none", opacity: packageRefOn ? 1 : 0.4 }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] leading-tight text-[var(--w-fg-strong)]">제품 보존 연출 {packageRefOn ? "적용 중" : "꺼짐"}</div>
              <div className="font-medium text-[12px] leading-snug text-[var(--w-fg-neutral)] mt-0.5">제품 원본(라벨·로고)은 그대로 두고 배경·씬만 컨셉별로 만들어요</div>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={() => setPackageRefOn((v) => !v)} className="border border-[var(--w-line-normal)]">
              {packageRefOn ? "끄기" : "켜기"}
            </Button>
            <label className={uploadBtnClass}>
              <Icon name="upload" size={13} /> 교체
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplaceRef(e.target.files)} />
            </label>
          </>
        ) : (
          <>
            <div className="flex-1">
              <div className="font-semibold text-[13px] leading-tight text-[var(--w-fg-strong)]">제품 레퍼런스 (선택)</div>
              <div className="font-medium text-[12px] leading-snug text-[var(--w-fg-neutral)] mt-0.5">제품 사진을 올리면 원본 그대로 두고 배경·씬만 생성해요</div>
            </div>
            <label className={uploadBtnClass}>
              <Icon name="upload" size={13} /> 제품 사진 첨부
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleReplaceRef(e.target.files)} />
            </label>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={suggest.isPending}
          onClick={handleSuggest}
          className="border border-[var(--w-line-normal)]"
        >
          <Icon name="sparkles" size={13} /> {suggest.isPending ? "컨셉 제안 중…" : "AI 컨셉 제안받기"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={pending.length > 0 || ![0, 1, 2].some(renderable)}
          onClick={generateAll}
          className="ml-auto"
        >
          {pending.length > 0 ? "생성 중…" : "3컷 모두 생성"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => {
          const src = images[i];
          const picked = !!src && src === value;
          const isPending = pending.includes(i);
          return (
            <div key={i} className="flex flex-col gap-2 p-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]">
              <div className="font-semibold text-[11px] leading-tight text-[var(--w-fg-neutral)] tracking-[0.03em] uppercase">
                {concepts[i]?.label?.trim() || `컨셉 ${i + 1}`}
              </div>
              <textarea
                aria-label={`컨셉 ${i + 1} 프롬프트`}
                placeholder="AI 컨셉을 제안받거나 직접 입력하세요 (영어 권장)"
                rows={3}
                value={concepts[i]?.prompt ?? ""}
                onChange={(e) =>
                  setConcepts((prev) => prev.map((c, idx) => (idx === i ? { ...c, prompt: e.target.value } : c)))
                }
                className="w-full px-2.5 py-2 border border-[var(--w-line-normal)] rounded-lg bg-[var(--w-bg-elevated)] font-medium text-[12px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-accent-violet)] resize-y"
              />

              {isPending ? (
                <Skeleton style={{ aspectRatio: "1 / 1", borderRadius: 8 }} />
              ) : src ? (
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => onChange(src)}
                  className="relative p-0 border-none bg-transparent cursor-pointer block w-full leading-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`컨셉 ${i + 1} 이미지`}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: 8,
                      border: `2px solid ${picked ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
                    }}
                  />
                  {picked && (
                    <>
                      <span className="absolute top-1 right-1">
                        <Icon name="check-circle" size={16} style={{ color: "var(--w-accent-violet)" }} />
                      </span>
                      <span className="absolute bottom-1 left-1 font-bold text-[10px] px-1.5 py-0.5 rounded bg-[var(--w-accent-violet)] text-white">
                        B 선택
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div
                  style={{ aspectRatio: "1 / 1" }}
                  className="rounded-lg border-[1.5px] border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] grid place-items-center text-[var(--w-fg-alternative)]"
                >
                  <Icon name="image" size={20} />
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={isPending || !renderable(i)}
                onClick={() => run([i])}
                className="border border-[var(--w-line-normal)] w-full"
              >
                {isPending ? "생성 중…" : src ? (<><Icon name="refresh" size={13} /> 다시 생성</>) : "이 컷 생성"}
              </Button>
            </div>
          );
        })}
      </div>

      {error && <p className="font-medium text-[12px] leading-[1.4] text-[var(--w-status-negative)] m-0">{error}</p>}
      <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)] m-0">
        AI 가 제안한 컨셉으로 이미지를 만들고, 한 장을 골라 챌린저(B) 이미지로 써요. 같은 제품·씬만 다르게, 나머지 요소는 챔피언과 동일해요.
      </p>
    </div>
  );
}
