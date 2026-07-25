"use client";

import { useRef, useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 480 }}>
      <div className="flex flex-col gap-[18px] p-6">
        <div className="flex items-center justify-between">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.014em] text-[var(--w-fg-strong)]">
            {product ? "제품 수정" : "제품 추가"}
          </DialogTitle>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* 제품 이미지 */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-[14px] text-[var(--w-fg-strong)]">제품 이미지 (선택)</span>
          <div className="flex items-center gap-[10px]">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="제품 이미지"
                className="w-[60px] h-[60px] object-cover rounded-lg border border-[var(--w-line-normal)]"
              />
            ) : (
              <div className="w-[60px] h-[60px] rounded-lg border border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] grid place-items-center">
                <Icon name="image" size={18} className="text-[var(--w-fg-alternative)]" />
              </div>
            )}
            <div className="flex gap-1.5">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] text-[var(--w-fg-strong)] cursor-pointer">
                  <Icon name="upload" size={12} />
                  {previewUrl ? "변경" : "업로드"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleImage(e.target.files)}
                />
              </label>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(null); setImageFile(undefined); }}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-transparent font-medium text-[13px] text-[var(--w-fg-neutral)] cursor-pointer"
                >
                  제거
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 제품명 */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">
            제품명 <span className="text-[var(--w-status-negative)]">*</span>
          </label>
          <input
            className={INPUT_CLS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 수분크림, 세럼, 토너"
          />
        </div>

        {/* 제품 설명 */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">
            제품 설명 <span className="text-[var(--w-status-negative)]">*</span>
          </label>
          <p className="m-0 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
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
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">가격 (선택)</label>
          <input
            className={INPUT_CLS}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="예) ₩29,000"
          />
        </div>

        {/* 랜딩 URL */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">랜딩 페이지 URL (선택)</label>
          <p className="m-0 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
            광고 만들기 STEP 02에서 자동으로 채워져요.
          </p>
          <input
            className={INPUT_CLS}
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://example.com/product"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
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
      </DialogContent>
    </Dialog>
  );
}
