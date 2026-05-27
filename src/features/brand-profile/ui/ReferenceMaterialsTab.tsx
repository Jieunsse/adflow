"use client";

import { useRef, useState } from "react";
import Icon from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import { cn } from "@shared/lib/cn";
import { useReferenceMaterials, formatBytes, type ReferenceMaterial } from "@shared/lib/referenceMaterials";

function TypeBadge({ type }: { type: ReferenceMaterial["type"] }) {
  const map = { image: "이미지", pdf: "PDF", txt: "TXT" } as const;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 7px",
      borderRadius: 999,
      font: "600 10.5px/1 var(--w-font-sans)",
      background: type === "image" ? "var(--w-primary-soft)" : type === "pdf" ? "#FEF3C7" : "var(--w-bg-alternative)",
      color: type === "image" ? "var(--w-primary-normal)" : type === "pdf" ? "#92400E" : "var(--w-fg-neutral)",
    }}>
      {map[type]}
    </span>
  );
}

export default function ReferenceMaterialsTab({ brandProfileId, canEdit }: { brandProfileId: string; canEdit: boolean }) {
  const showToast = useToast();
  const { materials, loading, upload, remove } = useReferenceMaterials(brandProfileId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await upload(file);
        showToast(`"${file.name}" 업로드됐어요`);
      } catch (e) {
        showToast((e as Error).message ?? "업로드에 실패했어요");
      }
    }
    setUploading(false);
  };

  const handleDelete = async (m: ReferenceMaterial) => {
    if (!confirm(`"${m.name}"을(를) 삭제할까요?`)) return;
    await remove(m.id);
    showToast("삭제됐어요");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <p className="m-0 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
        AI 카피·이미지 생성 시 참고할 자료를 보관하세요. STEP 02에서 직접 선택해 Gemini에 주입할 수 있어요.
      </p>

      {canEdit && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => { if (!uploading) inputRef.current?.click(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!uploading) inputRef.current?.click(); } }}
            role="button"
            aria-label="파일 선택"
            tabIndex={0}
            className={cn(
              "rounded-[14px] border-2 border-dashed outline-none transition-colors cursor-pointer grid place-items-center text-center py-8 px-4",
              dragOver
                ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-pale,rgba(99,93,255,0.06))]"
                : "border-[var(--w-line-normal)] bg-[var(--w-bg-base)] hover:border-[var(--w-line-strong)] focus:border-[var(--w-primary-normal)]"
            )}
          >
            <Icon name="upload" size={24} style={{ color: "var(--w-fg-neutral)" }} />
            <p className="m-0 mt-2 font-semibold text-[13.5px] text-[var(--w-fg-strong)]">
              {uploading ? "업로드 중..." : "클릭하거나 파일을 여기에 드래그"}
            </p>
            <p className="m-0 mt-1 font-medium text-[12px] text-[var(--w-fg-neutral)]">
              이미지(JPG·PNG·WebP)·PDF·TXT
            </p>
          </div>
        </div>
      )}

      {loading && (
        <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">불러오는 중…</p>
      )}

      {!loading && materials.length === 0 && (
        <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)] italic">
          아직 추가된 참고 자료가 없어요
        </p>
      )}

      {materials.length > 0 && (
        <div className="flex flex-col gap-2">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]"
            >
              {m.type === "image" && m.storageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.storageUrl}
                  alt={m.name}
                  style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid var(--w-line-normal)", flexShrink: 0 }}
                />
              )}
              {m.type !== "image" && (
                <div style={{ width: 40, height: 40, borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "var(--w-bg-alternative)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon name={m.type === "pdf" ? "doc" : "doc"} size={18} style={{ color: "var(--w-fg-neutral)" }} />
                </div>
              )}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-strong)] truncate">{m.name}</span>
                <div className="flex items-center gap-2">
                  <TypeBadge type={m.type} />
                  <span className="font-medium text-[11.5px] text-[var(--w-fg-neutral)]">{formatBytes(m.sizeBytes)}</span>
                  <span className="font-medium text-[11.5px] text-[var(--w-fg-neutral)]">
                    {new Date(m.uploadedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`${m.name} 삭제`}
                  onClick={() => handleDelete(m)}
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "var(--w-bg-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
