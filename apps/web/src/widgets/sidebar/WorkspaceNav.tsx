"use client";

// 워크스페이스 내비 셸. lg 이상은 지금까지처럼 고정 사이드바, 그 아래는 상단바 + 서랍.
// 대부분의 화면은 아직 viewport 1440 고정이라 lg 미만으로 내려오지 않는다 —
// 모바일 대응을 선언한 화면(목표 등)만 이 분기를 실제로 만난다.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@shared/ui/Icon";
import Sidebar from "./index";

export default function WorkspaceNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="lg:hidden sticky top-0 z-40 h-14 px-4 flex items-center gap-3 bg-[var(--w-bg-elevated)] border-b border-[var(--w-line-normal)]">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          className="w-9 h-9 -ml-1.5 grid place-items-center rounded-lg text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]"
        >
          <Icon name="grid" size={20} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 no-underline">
          <span className="w-7 h-7 rounded-lg bg-[linear-gradient(135deg,#0066ff_0%,#6541f2_55%,#00bdde_100%)] grid place-items-center text-white font-extrabold text-[15px] leading-none tracking-[-0.02em]">
            A
          </span>
          <span className="[font-family:var(--w-font-display)] font-extrabold text-[17px] leading-none tracking-[-0.022em] text-[var(--w-fg-strong)]">
            AdFlow
          </span>
        </Link>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="메뉴">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(0,0,0,0.45)] border-none cursor-pointer"
          />
          {/* 링크를 누르면 이동하면서 서랍이 닫힌다 — Sidebar 안의 링크를 위임으로 잡는다. */}
          <div
            className="relative w-[272px] max-w-[85vw] h-full overflow-y-auto shadow-[var(--w-shadow-strong)]"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
