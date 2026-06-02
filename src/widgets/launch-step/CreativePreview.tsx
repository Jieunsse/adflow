"use client";

// 광고 소재 미리보기 + 이미지 업로드 카드.
// 헤드라인·CTA 는 STEP 01 결과(useCreativeDraft), 이미지는 STEP 02 form(useLaunchDraft.imageDataUrl).

import { useEffect, useRef, useState } from "react";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { CTAS } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";
import SubHead from "./SubHead";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export default function CreativePreview() {
  const showToast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const [zoomed, setZoomed] = useState(false);

  const headline = creative.state.headline;
  const ctaLabel = CTAS.find((c) => c.id === creative.state.cta)?.label ?? creative.state.cta;
  // 텍스트 편집 결과(finalImageDataUrl)가 있으면 그걸 보여줌(없으면 베이스). final 은 항상 base 존재를 함의.
  const imageDataUrl = launch.state.finalImageDataUrl ?? launch.state.imageDataUrl;
  const hasCreative = headline.trim().length > 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("이미지 파일만 올릴 수 있어요"); return; }
    if (file.size > MAX_IMAGE_BYTES) { showToast("이미지 용량은 3MB 이하여야 해요"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        launch.dispatch({ type: "SET_IMAGE_DATA_URL", value: reader.result });
      }
    };
    reader.onerror = () => showToast("이미지를 읽지 못했어요");
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <>
      <SubHead title="광고 소재" />
      <div className="flex gap-3.5 p-3.5 border border-[var(--w-line-alternative)] rounded-[14px] items-center">
        <div
          className={cn(
            "w-[84px] h-[84px] rounded-xl grid place-items-center text-white shrink-0",
            imageDataUrl && "cursor-zoom-in"
          )}
          style={{
            background: imageDataUrl ? `url(${imageDataUrl}) center/cover` : "linear-gradient(135deg, #0066ff, #6541f2 60%, #00bdde)",
          }}
          onClick={imageDataUrl ? () => setZoomed(true) : undefined}
          role={imageDataUrl ? "button" : undefined}
          aria-label={imageDataUrl ? "광고 소재 크게 보기" : undefined}
        >
          {!imageDataUrl && <Icon name="image" size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-semibold text-[14px] leading-[1.4]",
            hasCreative ? "text-[var(--w-fg-strong)]" : "text-[var(--w-fg-alternative)]"
          )}>
            {hasCreative ? headline : "STEP 01에서 AI 소재를 먼저 만들어 주세요"}
          </div>
          <div className="font-medium text-[12px] leading-none text-[var(--w-fg-neutral)] mt-1.5">CTA · {ctaLabel}</div>
          <div className="flex gap-1.5 mt-2.5">
            <Button variant="secondary" size="sm" type="button" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={12} /> {imageDataUrl ? "이미지 변경" : "이미지 업로드"}
            </Button>
            {imageDataUrl && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => launch.dispatch({ type: "SET_IMAGE_DATA_URL", value: null })}
              >
                제거
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          </div>
        </div>
      </div>
      <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-normal)] mt-2.5 mb-0">
        업로드하지 않으면 아래에서 입력한 페이지의 og:image 가 사용돼요. JPEG·3MB 이하 권장.
      </p>

      {zoomed && imageDataUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          onClick={() => setZoomed(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24, cursor: "zoom-out" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageDataUrl}
            alt="확대 이미지"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "min(92vw, 1200px)", maxHeight: "92vh", objectFit: "contain", borderRadius: 8, cursor: "default", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "block" }}
          />
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setZoomed(false)}
            style={{ position: "fixed", top: 16, right: 16, width: 36, height: 36, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.94)", color: "#111", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
