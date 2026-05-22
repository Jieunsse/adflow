"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { useTheme, type ThemeChoice } from "@shared/lib/useTheme";
import NotificationBell from "@shared/ui/NotificationBell";
import LogoutButton from "@shared/ui/LogoutButton";
import { fetchCampaigns } from "@entities/campaign/api";

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
      {
        href: "/dashboard",
        label: "대시보드",
        icon: "grid",
        children: [
          { href: "/dashboard/business-portfolio", label: "비즈니스 포트폴리오", icon: "image" },
        ],
      },
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
      { href: "/posts", label: "Instagram 게시", icon: "image" },
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
  if (variant === "warn") {
    return `${COUNT_BASE} text-[#b06700] bg-[rgba(255,146,0,0.14)] dark:text-[#ffb24d] dark:bg-[rgba(255,146,0,0.18)]`;
  }
  if (variant === "primary" || active) {
    return `${COUNT_BASE} text-[var(--w-primary-press)] bg-[rgba(0,102,255,0.10)]`;
  }
  return `${COUNT_BASE} text-[var(--w-fg-alternative)] bg-[var(--w-bg-alternative)]`;
}

function linkClass(active: boolean, isSub = false) {
  const base = [
    "flex items-center gap-[11px] rounded-lg",
    "font-semibold leading-none tracking-[-0.003em]",
    "cursor-pointer border-none text-left",
    "transition-[background,color] duration-[120ms]",
    isSub ? "h-[34px] pl-9 pr-3 text-[12.5px]" : "h-[38px] px-3 text-[13.5px]",
  ];
  if (active) {
    base.push("bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]");
  } else if (isSub) {
    base.push(
      "bg-transparent text-[var(--w-fg-neutral)]",
      "hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)]"
    );
  } else {
    base.push(
      "bg-transparent text-[#121212] dark:text-[var(--w-fg-neutral)]",
      "hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)]"
    );
  }
  return base.join(" ");
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setTheme] = useTheme();

  const userName = session?.user?.name ?? "";
  const userInitial = userName.trim().charAt(0).toUpperCase() || "M";
  const userRole = session?.role;
  const adAccountName = session?.adAccountName;
  const pageName = session?.pageName;
  const connected = !!(adAccountName && pageName);

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

      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            <div
              className={`font-semibold text-[10.5px] leading-none uppercase tracking-[0.08em] text-[var(--w-fg-alternative)] px-3 pb-1.5 ${gi === 0 ? "pt-3.5" : "pt-[18px]"}`}
            >
              {group.label}
            </div>
            {group.items.map((it) => {
              const hasChildren = !!it.children?.length;
              const active = hasChildren
                ? pathname === it.href
                : pathname === it.href || pathname.startsWith(it.href + "/");
              const liveCount = it.href === "/approvals" ? approvalsCount : it.count;
              return (
                <div key={it.href}>
                  <Link href={it.href} className={linkClass(active)}>
                    <span className="w-[18px] h-[18px] grid place-items-center">
                      <Icon name={it.icon} size={18} />
                    </span>
                    <span>{it.label}</span>
                    {it.chip && (
                      <span className={countClass(undefined, active)}>{it.chip}</span>
                    )}
                    {liveCount != null && liveCount > 0 && (
                      <span className={countClass(it.countVariant, active)}>{liveCount}</span>
                    )}
                  </Link>
                  {hasChildren &&
                    it.children!.map((child) => {
                      const childActive =
                        pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <Link key={child.href} href={child.href} className={linkClass(childActive, true)}>
                          <span className="w-4 h-4 grid place-items-center">
                            <Icon name={child.icon} size={16} />
                          </span>
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                </div>
              );
            })}
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

        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--w-bg-alternative)]">
          {THEME_BUTTONS.map((b) => (
            <button
              key={b.id}
              onClick={() => setTheme(b.id)}
              className={`flex-1 h-7 border-none rounded-full font-semibold text-xs leading-none cursor-pointer flex items-center justify-center gap-1.5 transition-[background,color] duration-[160ms] ${
                theme === b.id
                  ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                  : "bg-transparent text-[var(--w-fg-neutral)]"
              }`}
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
                  className={`inline-flex items-center px-[7px] py-0.5 rounded-[20px] font-semibold text-[10px] leading-[1.4] mt-1 ${
                    userRole === "팀장"
                      ? "bg-[rgba(0,102,255,0.12)] text-[var(--w-primary-normal)]"
                      : "bg-[var(--w-bg-neutral)] text-[var(--w-fg-neutral)]"
                  }`}
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
