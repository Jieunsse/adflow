"use client";

import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/instagram": "인사이트",
  "/instagram/posts": "게시",
  "/instagram/comments": "댓글 관리",
  "/instagram/stories": "스토리",
  "/instagram/reels": "릴스",
  "/instagram/partnerships": "파트너십",
  "/instagram/messages": "메시지",
};

export default function InstagramLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = TITLE_MAP[pathname] ?? "";

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7">
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">채널 관리 · Instagram</span>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">{title}</h1>
      </div>
      {children}
    </div>
  );
}
