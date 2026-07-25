"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { IgPostPreview } from "@shared/ui/IgPostPreview";
import { cn } from "@shared/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";

interface MediaItem {
  id: string;
  caption: string;
  mediaUrl: string;
  permalink?: string;
  timestamp: string;
  likeCount: number;
}

interface Props {
  onImport: (texts: string[]) => void;
  onClose: () => void;
}

export default function IgImportModal({ onImport, onClose }: Props) {
  const { data: session } = useSession();
  const handle = session?.igUsername ?? "instagram";

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instagram/recent-media?limit=20")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.items ?? []) as MediaItem[];
        const filtered = list.filter((m) => m.caption?.trim());
        setItems(filtered);
        if (filtered.length > 0) setPreviewId(filtered[0].id);
        setLoading(false);
      })
      .catch(() => {
        setError("게시글을 불러오지 못했어요. 인스타그램 연동 상태를 확인해주세요.");
        setLoading(false);
      });
  }, []);

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const texts = items
      .filter((m) => selected.has(m.id))
      .map((m) => m.caption.trim());
    onImport(texts);
    onClose();
  };

  const previewed = items.find((m) => m.id === previewId) ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 800 }} className="flex flex-col max-h-[80vh] p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--w-line-normal)] shrink-0">
          <div>
            <DialogTitle className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
              IG 게시글에서 가져오기
            </DialogTitle>
            <p className="m-0 mt-1 font-medium text-[13px] text-[var(--w-fg-neutral)]">
              가져올 게시글을 선택하세요
            </p>
          </div>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--w-bg-alternative)] transition-colors"
            onClick={onClose}
          >
            <Icon name="x" size={16} style={{ color: "var(--w-fg-neutral)" }} />
          </button>
        </div>

        {/* Body: 2-panel */}
        <div className="flex flex-1 min-h-0">
          {/* Left: list */}
          <div className="w-2/5 overflow-y-auto px-4 py-4 flex flex-col gap-2 border-r border-[var(--w-line-normal)]">
            {loading && (
              <p className="font-medium text-[13px] text-[var(--w-fg-alternative)] text-center py-8">
                불러오는 중…
              </p>
            )}
            {error && (
              <p className="font-medium text-[13px] text-[var(--w-status-negative)] text-center py-8">
                {error}
              </p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="font-medium text-[13px] text-[var(--w-fg-alternative)] text-center py-8">
                캡션이 있는 게시글이 없어요
              </p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setPreviewId(item.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-[border-color,background] duration-[120ms]",
                  selected.has(item.id)
                    ? "border-[var(--w-primary-normal)] bg-[rgba(0,102,255,0.04)]"
                    : item.id === previewId
                    ? "border-[var(--w-line-strong)] bg-[var(--w-bg-alternative)]"
                    : "border-[var(--w-line-normal)] hover:border-[var(--w-line-strong)]"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0 accent-[var(--w-primary-normal)]"
                  checked={selected.has(item.id)}
                  onChange={() => {}}
                  onClick={(e) => toggle(item.id, e)}
                />
                <p className="m-0 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] line-clamp-3">
                  {item.caption}
                </p>
              </div>
            ))}
          </div>

          {/* Right: preview */}
          <div className="w-3/5 overflow-y-auto px-6 py-6 flex items-start justify-center bg-[var(--w-bg-base)]">
            {previewed ? (
              <IgPostPreview
                imageUrl={previewed.mediaUrl}
                caption={previewed.caption}
                handle={handle}
                timestamp={previewed.timestamp}
                likeCount={previewed.likeCount}
                className="w-full max-w-[320px]"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--w-fg-alternative)] text-[13px] font-medium">
                게시글을 클릭하면 미리보기가 나타나요
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--w-line-normal)] flex items-center justify-between gap-3 shrink-0">
          <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">
            {selected.size > 0 ? `${selected.size}개 선택됨` : "선택 없음"}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>취소</Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              {selected.size > 0 ? `${selected.size}개 추가` : "추가"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
