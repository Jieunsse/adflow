"use client";

// PRD-create-flow-redesign §3.2 — 스튜디오 ② 이미지 섹션. 상단 카피/제품 요약은 좌측 FeedPreview 가
// 대신하므로 제거. AiImageBlock(컨셉 제안→3장 생성→선택→TextOverlayEditor)만 배치, 내부 로직 불변.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useCreativeDraft } from "@entities/creative/model";
import AiImageBlock from "./AiImageBlock";
import TextOverlayEditor from "./TextOverlayEditor";

export default function ImagePhase({
  productId,
  imageDataUrl,
  setImageDataUrl,
  finalImageDataUrl,
  setFinalImageDataUrl,
}: {
  productId: string | null;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
  finalImageDataUrl: string | null;
  setFinalImageDataUrl: (v: string | null) => void;
}) {
  const { state } = useCreativeDraft();
  const [editing, setEditing] = useState(false);

  const handleSelectImage = (v: string | null) => {
    if (v !== imageDataUrl) setFinalImageDataUrl(null);
    setImageDataUrl(v);
  };

  return (
    <Card variant="lg">
      <div>
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">② 이미지</h2>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">선택한 카피에 어울리는 이미지를 빚어 보세요.</p>
      </div>

      <div style={{ marginTop: 16 }}>
        <AiImageBlock productId={productId} imageDataUrl={imageDataUrl} finalImageDataUrl={finalImageDataUrl} setImageDataUrl={handleSelectImage} />
      </div>

      {imageDataUrl && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={finalImageDataUrl ?? imageDataUrl} alt="선택한 이미지" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: "1.5px solid var(--w-primary-normal)", flex: "none" }} />
            <span className="font-semibold text-[15px] leading-[1.35] text-[var(--w-fg-strong)] truncate">
              {finalImageDataUrl ? "텍스트 적용됨" : "이 이미지로 광고를 만들어요"}
            </span>
          </div>
          <Button variant="ghost" type="button" onClick={() => setEditing(true)} className="border border-[var(--w-line-normal)]">
            <Icon name="edit" size={14} /> 텍스트 편집
          </Button>
        </div>
      )}
      <p className="text-[12px] font-medium text-[var(--w-fg-alternative)] mt-2.5 mb-0 text-center">
        AI가 만든 이미지예요 — 정책·저작권·초상권은 직접 확인해주세요.
      </p>

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
