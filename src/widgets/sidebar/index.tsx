"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon, { type IconName } from "@shared/ui/Icon";
import { useTheme, type ThemeChoice } from "@shared/lib/useTheme";
import NotificationBell from "@shared/ui/NotificationBell";
import LogoutButton from "@shared/ui/LogoutButton";

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
          { href: "/dashboard/instagram", label: "Instagram", icon: "image" },
        ],
      },
      { href: "/create", label: "광고 만들기", icon: "sparkles", chip: "AI" },
    ],
  },
  {
    label: "캠페인 관리",
    items: [
      { href: "/campaigns", label: "캠페인", icon: "message", count: 12, countVariant: "primary" },
      { href: "/approvals", label: "승인 대기", icon: "clock", count: 7, countVariant: "warn" },
      { href: "/library", label: "소재 라이브러리", icon: "folder" },
    ],
  },
  {
    label: "워크스페이스",
    items: [
      { href: "/members", label: "구성원 · 권한", icon: "users" },
      { href: "/connect", label: "계정 연결", icon: "asterisk" },
      { href: "/settings", label: "설정", icon: "settings" },
    ],
  },
];

const THEME_BUTTONS: { id: ThemeChoice; icon: IconName; label: string }[] = [
  { id: "light", icon: "sun", label: "라이트" },
  { id: "dark", icon: "moon", label: "다크" },
  { id: "system", icon: "monitor", label: "자동" },
];

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

  return (
    <aside className="side">
      <div className="side__brand">
        <div className="side__mark">A</div>
        <div>
          <div className="side__name">AdFlow</div>
          <div className="side__name-sub">Marketing AI Studio</div>
        </div>
      </div>

      <nav className="side__nav">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            <div className="side__group-label" style={gi === 0 ? undefined : { paddingTop: 18 }}>
              {group.label}
            </div>
            {group.items.map((it) => {
              const hasChildren = !!it.children?.length;
              const active = hasChildren
                ? pathname === it.href
                : pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <div key={it.href}>
                  <Link
                    href={it.href}
                    className={"side__link" + (active ? " side__link--on" : "")}
                  >
                    <span className="side__link-icon"><Icon name={it.icon} size={18} /></span>
                    <span>{it.label}</span>
                    {it.chip && <span className="side__link-count">{it.chip}</span>}
                    {it.count != null && (
                      <span className={"side__link-count" + (it.countVariant === "warn" ? " side__link-count--warn" : it.countVariant === "primary" ? " side__link-count--primary" : "")}>
                        {it.count}
                      </span>
                    )}
                  </Link>
                  {hasChildren && it.children!.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={"side__link side__link--sub" + (childActive ? " side__link--on" : "")}
                      >
                        <span className="side__link-icon"><Icon name={child.icon} size={16} /></span>
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

      <div className="side__foot">
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--w-bg-alternative)" }}>
          <div style={{ font: "600 10.5px/1 var(--w-font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--w-fg-alternative)", marginBottom: 8 }}>
            연결 상태
          </div>
          {connected ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "var(--w-status-positive)" }} />
                <span style={{ font: "600 12px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>연결됨</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, color: "var(--w-fg-neutral)" }}>
                <Icon name="wallet" size={11} />
                <span style={{ font: "500 11.5px/1.3 var(--w-font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {adAccountName}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--w-fg-neutral)" }}>
                <Icon name="doc" size={11} />
                <span style={{ font: "500 11.5px/1.3 var(--w-font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pageName}
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--w-fg-alternative)" }} />
              <span style={{ font: "600 12px/1.3 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>미연결</span>
            </div>
          )}
        </div>

        <div className="side__theme">
          {THEME_BUTTONS.map((b) => (
            <button key={b.id} onClick={() => setTheme(b.id)} className={theme === b.id ? "on" : ""} title={b.label} type="button">
              <Icon name={b.icon} size={13} />
              {b.label}
            </button>
          ))}
        </div>

        <div className="side__user">
          <Link href="/settings" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, textDecoration: "none" }}>
            <div className="side__avatar">{userInitial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="side__user-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userName || "마케터"}
              </div>
              {userRole && (
                <div className={"side__role-badge" + (userRole === "팀장" ? " side__role-badge--lead" : " side__role-badge--member")}>
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
