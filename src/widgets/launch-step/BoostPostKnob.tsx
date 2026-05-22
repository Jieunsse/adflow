"use client";

import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";

export interface IgMediaItem {
  id: string;
  mediaUrl: string;
  caption: string;
  timestamp: string;
}

interface Props {
  selectedId: string | null;
  onSelect: (media: IgMediaItem) => void;
}

export default function BoostPostKnob({ selectedId, onSelect }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ig-recent-media"],
    queryFn: async (): Promise<{ ok: boolean; items: IgMediaItem[]; mock?: boolean }> => {
      const res = await fetch("/api/instagram/recent-media");
      if (!res.ok) throw new Error("게시물을 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-[var(--w-fg-neutral)]">
        <Icon name="spinner" size={16} />
        <span className="font-medium text-[13.5px]">게시물 불러오는 중…</span>
      </div>
    );
  }

  if (isError || !data?.items.length) {
    return (
      <div className="text-center py-8 text-[var(--w-fg-neutral)] font-medium text-[13.5px]">
        인스타그램 게시물을 불러오지 못했어요. 계정이 연결돼 있는지 확인해주세요.
      </div>
    );
  }

  const selected = data.items.find((m) => m.id === selectedId);

  return (
    <div>
      {data.mock && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] font-medium text-[12px]">
          시연용 게시물이에요 — 실제 IG 계정 연결 후 내 게시물이 표시돼요.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {data.items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            className={cn(
              "relative overflow-hidden rounded-xl border-2 transition-[border-color,box-shadow] duration-[120ms] cursor-pointer p-0 bg-[var(--w-bg-alternative)]",
              selectedId === m.id
                ? "border-[var(--w-accent-violet)] shadow-[0_0_0_3px_rgba(101,65,242,0.12)]"
                : "border-transparent hover:border-[var(--w-line-normal)]"
            )}
            style={{ aspectRatio: "1/1" }}
          >
            {m.mediaUrl ? (
              <img src={m.mediaUrl} alt={m.caption || "IG 게시물"} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="image" size={24} style={{ color: "var(--w-fg-neutral)" }} />
              </div>
            )}
            {selectedId === m.id && (
              <div className="absolute inset-0 bg-[rgba(101,65,242,0.08)] flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-[var(--w-accent-violet)] flex items-center justify-center">
                  <Icon name="check" size={13} style={{ color: "#fff" }} />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-[var(--w-bg-alternative)]">
          <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-normal)] m-0 line-clamp-2">
            {selected.caption || "캡션 없음"}
          </p>
        </div>
      )}
    </div>
  );
}
