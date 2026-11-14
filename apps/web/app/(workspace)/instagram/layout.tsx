"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CONTENT_PATHS = ["/instagram/posts", "/instagram/stories", "/instagram/reels"];

const TITLE_MAP: Record<string, string> = {
  "/instagram": "인사이트",
  "/instagram/partnerships": "파트너십",
  "/instagram/comments": "댓글 관리",
  "/instagram/messages": "DM",
};

export default function InstagramLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = CONTENT_PATHS.includes(pathname)
    ? [
        { href: "/instagram/posts", label: "게시" },
        { href: "/instagram/stories", label: "스토리" },
        { href: "/instagram/reels", label: "릴스" },
      ]
    : null;
  const title = tabs ? "콘텐츠" : (TITLE_MAP[pathname] ?? "");

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label={`Instagram ${title}`}>
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">채널 관리 · Instagram</span>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">{title}</h1>
      </div>
      {tabs && (
        <nav className="inline-flex w-fit gap-0.5 rounded-lg bg-[var(--w-bg-alternative)] p-0.5" aria-label={`${title} 메뉴`}>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={pathname === tab.href ? "page" : undefined}
              className={`w-label rounded-lg px-3 py-2 no-underline ${
                pathname === tab.href ? "bg-[var(--w-bg-elevated)]" : "text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </div>
  );
}
