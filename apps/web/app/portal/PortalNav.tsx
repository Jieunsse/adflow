"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import NotificationBell from "@shared/ui/NotificationBell";

const LINKS = [
  { href: "/portal", label: "이번 달" },
  { href: "/portal/reports", label: "리포트" },
  { href: "/portal/learnings", label: "배운 것" },
  { href: "/portal/experiments", label: "진행 중 실험" },
];

export default function PortalNav() {
  const path = usePathname();
  return (
    <header className="border-b border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]">
      <nav aria-label="고객 메뉴" className="max-w-[960px] mx-auto px-4 md:px-6 h-14 flex items-center gap-1 overflow-x-auto">
        <span className="font-bold text-[15px] text-[var(--w-fg-strong)] mr-4">AdFlow</span>
        {LINKS.map((l) => {
          const on = l.href === "/portal" ? path === "/portal" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={`px-3 py-2 rounded-lg whitespace-nowrap font-semibold text-[14px] ${on ? "text-[var(--w-primary-normal)] bg-[var(--w-primary-soft)]" : "text-[var(--w-fg-neutral)]"}`}
            >
              {l.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="px-3 py-2 font-semibold text-[13px] text-[var(--w-fg-neutral)]">
            로그아웃
          </button>
        </div>
      </nav>
    </header>
  );
}
