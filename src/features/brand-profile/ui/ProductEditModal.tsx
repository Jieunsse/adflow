"use client";

import { useRef, useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import type { ProductEntry } from "@shared/lib/products";

const INPUT_CLS =
  "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]";

const TEXTAREA_CLS = cn(INPUT_CLS, "resize-y min-h-[72px] leading-[1.6]");

interface Props {
  brandProfileId: string;
  product?: ProductEntry;
  onSave: (entry: ProductEntry, imageFile?: File) => Promise<void>;
  onClose: () => void;
}

export default function ProductEditModal({ brandProfileId, product, onSave, onClose }: Props) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [targetUrl, setTargetUrl] = useState(product?.targetUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    try {
      const entry: ProductEntry = {
        id: product?.id ?? `prod_${crypto.randomUUID()}`,
        brandProfileId,
        name: name.trim(),
        description: description.trim(),
        price: price.trim() || undefined,
        targetUrl: targetUrl.trim() || undefined,
        imageUrl: previewUrl ?? undefined,
        createdAt: product?.createdAt ?? Date.now(),
      };
      await onSave(entry, imageFile);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--w-bg-normal)", borderRadius: 16,
          border: "1px solid var(--w-line-normal)",
          padding: "24px 28px", width: "100%", maxWidth: 480,
          display: "flex", flexDirection: "column", gap: 18,
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            {product ? "제품 수정" : "제품 추가"}
          </span>
          <button type="button" onClick={onClose} style={{ padding: 4, cursor: "pointer", background: "transparent", border: "none" }}>
            <Icon name="x" size={18} style={{ color: "var(--w-fg-neutral)" }} />
          </button>
        </div>

        {/* 제품 이미지 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>제품 이미지 (선택)</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="제품 이미지"
                style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--w-line-normal)" }}
              />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 8, border: "1px dashed var(--w-line-normal)", background: "var(--w-bg-alternative)", display: "grid", placeItems: "center" }}>
                <Icon name="image" size={18} style={{ color: "var(--w-fg-alternative)" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <label style={{ cursor: "pointer" }}>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid var(--w-line-normal)", background: "var(--w-bg-elevated)",
                    font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-strong)", cursor: "pointer",
                  }}
                >
                  <Icon name="upload" size={12} />
                  {previewUrl ? "변경" : "업로드"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => handleImage(e.target.files)}
                />
              </label>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(null); setImageFile(undefined); }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--w-line-normal)", background: "transparent", font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", cursor: "pointer" }}
                >
                  제거
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 제품명 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            제품명 <span style={{ color: "var(--w-status-negative)" }}>*</span>
          </label>
          <input
            className={INPUT_CLS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 수분크림, 세럼, 토너"
          />
        </div>

        {/* 제품 설명 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            제품 설명 <span style={{ color: "var(--w-status-negative)" }}>*</span>
          </label>
          <p style={{ margin: 0, font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
            강점·성분·사용감 등 AI 카피 생성에 활용돼요.
          </p>
          <textarea
            className={TEXTAREA_CLS}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예) 히알루론산 5중 복합체로 72시간 지속 보습. 무향·무알코올, 민감한 피부에도 안전해요."
          />
        </div>

        {/* 가격 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>가격 (선택)</label>
          <input
            className={INPUT_CLS}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="예) ₩29,000"
          />
        </div>

        {/* 랜딩 URL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>랜딩 페이지 URL (선택)</label>
          <p style={{ margin: 0, font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
            광고 만들기 STEP 02에서 자동으로 채워져요.
          </p>
          <input
            className={INPUT_CLS}
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://example.com/product"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <Button variant="secondary" type="button" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            type="button"
            disabled={saving || !name.trim() || !description.trim()}
            onClick={handleSave}
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
