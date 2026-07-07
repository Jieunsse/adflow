"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { useTheme, type ThemeChoice } from "@shared/lib/useTheme";
import { usePresenterConsole } from "@shared/lib/usePresenterConsole";
import NotificationBell from "@shared/ui/NotificationBell";
import LogoutButton from "@shared/ui/LogoutButton";
import { fetchCampaigns } from "@entities/campaign/api";
import { cn } from "@shared/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  chip?: string;
  count?: number;
  countVariant?: "warn" | "primary";
  children?: NavItem[];
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "메인",
    items: [
      { href: "/dashboard", label: "대시보드", icon: "grid" },
      { href: "/goals", label: "목표", icon: "target" },
      { href: "/create", label: "광고 만들기", icon: "sparkles", chip: "AI" },
    ],
  },
  {
    label: "캠페인 관리",
    items: [
      { href: "/campaigns", label: "캠페인", icon: "message", count: 12, countVariant: "primary" },
      { href: "/ab-tests", label: "A/B 테스트", icon: "chart" },
      { href: "/approvals", label: "승인 대기", icon: "clock", countVariant: "warn" },
      { href: "/library", label: "소재 라이브러리", icon: "folder" },
    ],
  },
  {
    label: "인플루언서",
    items: [
      { href: "/creators", label: "크리에이터", icon: "user" },
      { href: "/creators/campaigns", label: "협업 캠페인", icon: "megaphone" },
      { href: "/instagram/partnerships", label: "파트너십 콘텐츠", icon: "hash" },
    ],
  },
  {
    label: "채널 관리",
    items: [
      {
        href: "/instagram",
        label: "Instagram",
        icon: "instagram",
        children: [
          { href: "/instagram", label: "인사이트", icon: "chart" },
          { href: "/instagram/posts", label: "게시", icon: "image" },
          { href: "/instagram/comments", label: "댓글 관리", icon: "comment" },
          { href: "/instagram/stories", label: "스토리", icon: "play" },
          { href: "/instagram/reels", label: "릴스", icon: "play" },
          { href: "/instagram/messages", label: "메시지", icon: "message" },
        ],
      },
      {
        href: "/facebook",
        label: "Facebook",
        icon: "facebook",
        children: [
          { href: "/facebook", label: "인사이트", icon: "chart" },
          { href: "/facebook/posts", label: "게시물", icon: "image" },
        ],
      },
    ],
  },
  {
    label: "브랜드 & 정책",
    items: [
      { href: "/brand-profile", label: "브랜드 프로필", icon: "asterisk" },
    ],
  },
  {
    label: "워크스페이스",
    items: [
      { href: "/members", label: "구성원 · 권한", icon: "users" },
      { href: "/connect", label: "계정 연결", icon: "asterisk" },
      { href: "/billing", label: "청구 및 결제", icon: "wallet" },
      { href: "/settings", label: "설정", icon: "settings" },
    ],
  },
];

const THEME_BUTTONS: { id: ThemeChoice; icon: IconName; label: string }[] = [
  { id: "light", icon: "sun", label: "라이트" },
  { id: "dark", icon: "moon", label: "다크" },
  { id: "system", icon: "monitor", label: "자동" },
];

const COUNT_BASE =
  "ml-auto font-semibold text-[11px] leading-none [font-family:var(--w-font-mono)] px-[7px] py-[3px] rounded-full";

function countClass(variant: "warn" | "primary" | undefined, active: boolean) {
  return cn(COUNT_BASE, {
    "text-[#b06700] bg-[rgba(255,146,0,0.14)] dark:text-[#ffb24d] dark:bg-[rgba(255,146,0,0.18)]":
      variant === "warn",
    "text-[var(--w-primary-press)] bg-[rgba(0,102,255,0.10)]":
      variant === "primary",
    "text-[var(--w-fg-strong)] bg-[var(--w-bg-neutral)]":
      active && variant !== "primary" && variant !== "warn",
    "text-[var(--w-fg-alternative)] bg-[var(--w-bg-alternative)]":
      variant !== "warn" && variant !== "primary" && !active,
  });
}

function linkClass(active: boolean, isSub = false, isParent = false) {
  return cn(
    "flex items-center gap-[11px] rounded-lg",
    "font-semibold leading-none tracking-[-0.003em]",
    "cursor-pointer border-none text-left",
    "transition-[background,color] duration-[120ms]",
    isSub ? "h-[34px] pl-9 pr-3 text-[12.5px]" : "h-[38px] px-3 text-[13.5px]",
    active
      ? isParent
        ? "bg-transparent text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]"
        : "bg-[var(--w-bg-neutral)] text-[var(--w-fg-strong)]"
      : isSub
        ? "bg-transparent text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)]"
        : "bg-transparent text-[#121212] dark:text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)]"
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setTheme] = useTheme();
  const [consoleOn, setConsoleOn] = usePresenterConsole();
  const browseMode = !!session?.browseMode;

  const userName = session?.user?.name ?? "";
  const userInitial = userName.trim().charAt(0).toUpperCase() || "M";
  const userRole = session?.role;
  const adAccountName = session?.adAccountName;
  const pageName = session?.pageName;
  const connected = !!(adAccountName && pageName);

  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
          open.add(item.href);
        }
      }
    }
    return open;
  });

  useEffect(() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
          setOpenItems((prev) => {
            if (prev.has(item.href)) return prev;
            return new Set([...prev, item.href]);
          });
        }
      }
    }
  }, [pathname]);

  function toggleItem(href: string) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  // /approvals 배지 — review + issue 캠페인 합. 같은 queryKey 로 /campaigns·/approvals 페이지와 캐시 공유.
  // 광고 계정 연결 전(=session 없거나 미연결)엔 fetch 안 함 (401 무한 호출 회피).
  const approvalsQ = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => fetchCampaigns("all"),
    enabled: connected,
    retry: false,
  });
  const approvalsCount = approvalsQ.data
    ? approvalsQ.data.filter((c) => c.status === "review" || c.status === "issue").length
    : 0;

  return (
    <aside className="sticky top-0 h-screen bg-[var(--w-bg-elevated)] border-r border-[var(--w-line-normal)] flex flex-col pt-5 px-3.5 pb-4 gap-5">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 pt-1 px-2 pb-2 no-underline text-inherit"
      >
        <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#0066ff_0%,#6541f2_55%,#00bdde_100%)] grid place-items-center text-white font-extrabold text-[17px] leading-none tracking-[-0.02em]">
          A
        </div>
        <div>
          <div className="[font-family:var(--w-font-display)] font-extrabold text-[18px] leading-none tracking-[-0.022em] text-[var(--w-fg-strong)]">
            AdFlow
          </div>
          <div className="font-medium text-[11px] leading-[1.2] tracking-[0.012em] text-[var(--w-fg-neutral)] mt-0.5">
            Marketing AI Studio
          </div>
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto -mx-3.5 px-3.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            <div
              className={cn(
                "font-semibold text-[10.5px] leading-none uppercase tracking-[0.08em] text-[var(--w-fg-alternative)] px-3 pb-1.5",
                gi === 0 ? "pt-3.5" : "pt-[18px]"
              )}
            >
              {group.label}
            </div>
            {(() => {
              const bestGroupMatch = group.items.reduce<NavItem | null>((best, it) => {
                const matches = pathname === it.href || pathname.startsWith(it.href + "/");
                if (!matches) return best;
                return !best || it.href.length > best.href.length ? it : best;
              }, null);
              return group.items.map((it) => {
              const hasChildren = !!it.children?.length;
              const active = it.href === bestGroupMatch?.href;
              const liveCount = it.href === "/approvals" ? approvalsCount : it.count;
              const isOpen = hasChildren && openItems.has(it.href);
              return (
                <div key={it.href}>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => toggleItem(it.href)}
                      className={cn(linkClass(active, false, true), "w-full")}
                    >
                      <span
                        className="w-[18px] h-[18px] grid place-items-center"
                        style={
                          it.icon === "instagram"
                            ? { color: "#E1306C" }
                            : it.icon === "facebook"
                              ? { color: "#1877F2" }
                              : undefined
                        }
                      >
                        <Icon name={it.icon} size={18} />
                      </span>
                      <span>{it.label}</span>
                      {it.chip && (
                        <span className={countClass(undefined, active)}>{it.chip}</span>
                      )}
                      <span className={cn("ml-auto transition-transform duration-200", isOpen && "rotate-180")}>
                        <Icon name="chev-down" size={14} />
                      </span>
                    </button>
                  ) : (
                    <Link href={it.href} className={linkClass(active)}>
                      <span
                        className="w-[18px] h-[18px] grid place-items-center"
                        style={it.icon === "facebook" ? { color: "#1877F2" } : undefined}
                      >
                        <Icon name={it.icon} size={18} />
                      </span>
                      <span>{it.label}</span>
                      {it.chip && (
                        <span className={countClass(undefined, it.chip === "AI" ? true : active)}>{it.chip}</span>
                      )}
                      {liveCount != null && liveCount > 0 && (
                        <span className={countClass(it.countVariant, active)}>{liveCount}</span>
                      )}
                    </Link>
                  )}
                  {hasChildren && isOpen && (() => {
                    const bestMatch = it.children!.reduce<NavItem | null>((best, c) => {
                      const matches = pathname === c.href || pathname.startsWith(c.href + "/");
                      if (!matches) return best;
                      return !best || c.href.length > best.href.length ? c : best;
                    }, null);
                    return it.children!.map((child) => {
                      const childActive = child.href === bestMatch?.href;
                      return (
                        <Link key={child.href} href={child.href} className={linkClass(childActive, true)}>
                          <span className="w-4 h-4 grid place-items-center">
                            <Icon name={child.icon} size={16} />
                          </span>
                          <span>{child.label}</span>
                        </Link>
                      );
                    });
                  })()}
                </div>
              );
              });
            })()}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 pt-3 border-t border-[var(--w-line-alternative)]">
        <div className="px-3 py-2.5 rounded-[10px] bg-[var(--w-bg-alternative)]">
          <div className="font-semibold text-[10.5px] leading-none uppercase tracking-[0.08em] text-[var(--w-fg-alternative)] mb-2">
            연결 상태
          </div>
          {connected ? (
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[var(--w-status-positive)]" />
                <span className="font-semibold text-[12px] leading-[1.3] text-[var(--w-fg-strong)]">연결됨</span>
              </div>
              <div className="flex items-center gap-1.5 mb-1 text-[var(--w-fg-neutral)]">
                <Icon name="wallet" size={11} />
                <span className="font-medium text-[11.5px] leading-[1.3] whitespace-nowrap overflow-hidden text-ellipsis">
                  {adAccountName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--w-fg-neutral)]">
                <Icon name="doc" size={11} />
                <span className="font-medium text-[11.5px] leading-[1.3] whitespace-nowrap overflow-hidden text-ellipsis">
                  {pageName}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--w-fg-alternative)]" />
              <span className="font-semibold text-[12px] leading-[1.3] text-[var(--w-fg-neutral)]">미연결</span>
            </div>
          )}
        </div>

        {browseMode && (
          <button
            type="button"
            onClick={() => setConsoleOn((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-[var(--w-bg-alternative)] border-none cursor-pointer text-left w-full"
            title="시간경과 콘솔(빨리감기 바) 표시 전환"
          >
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--w-bg-elevated)] text-[var(--w-fg-neutral)] shrink-0">
              <Icon name="play" size={14} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)]">시간경과 콘솔</span>
              <span className="block font-medium text-[11px] leading-[1.3] text-[var(--w-fg-neutral)]">
                빨리감기 바 {consoleOn ? "표시" : "숨김"}
              </span>
            </span>
            <span
              className={cn(
                "relative w-9 h-5 rounded-full shrink-0 transition-colors duration-[160ms]",
                consoleOn ? "bg-[var(--w-primary-normal)]" : "bg-[var(--w-line-neutral)]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-[160ms]",
                  consoleOn ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        )}

        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--w-bg-alternative)]">
          {THEME_BUTTONS.map((b) => (
            <button
              key={b.id}
              onClick={() => setTheme(b.id)}
              className={cn(
                "flex-1 h-7 border-none rounded-full font-semibold text-xs leading-none cursor-pointer flex items-center justify-center gap-1.5 transition-[background,color] duration-[160ms]",
                theme === b.id
                  ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                  : "bg-transparent text-[var(--w-fg-neutral)]"
              )}
              title={b.label}
              type="button"
            >
              <Icon name={b.icon} size={13} />
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-[10px] hover:bg-[var(--w-bg-neutral)]">
          <Link
            href="/settings"
            className="flex items-center gap-2 flex-1 min-w-0 no-underline"
          >
            <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#0066ff,#6541f2)] text-white grid place-items-center font-bold text-xs leading-none shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] leading-[1.2] text-[var(--w-fg-strong)] whitespace-nowrap overflow-hidden text-ellipsis">
                {userName || "마케터"}
              </div>
              {userRole && (
                <div
                  className={cn(
                    "inline-flex items-center px-[7px] py-0.5 rounded-[20px] font-semibold text-[10px] leading-[1.4] mt-1",
                    userRole === "팀장"
                      ? "bg-[rgba(0,102,255,0.12)] text-[var(--w-primary-normal)]"
                      : "bg-[var(--w-bg-neutral)] text-[var(--w-fg-neutral)]"
                  )}
                >
                  {userRole}
                </div>
              )}
            </div>
          </Link>
          <NotificationBell />
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
