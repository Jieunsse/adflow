"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { MOCK_MEMBERS, type Member, type MemberStatus, type Role } from "@/lib/mock-members";

const WORKSPACE = { name: "그린루틴 마케팅팀", initial: "그", gradient: "linear-gradient(135deg,#0066ff,#6541f2)" };

const ROLE_DEF: Record<Role, { label: string; desc: string }> = {
  owner: { label: "팀장", desc: "모든 권한" },
  launcher: { label: "팀원·게재", desc: "생성·검토·게재" },
  reviewer: { label: "팀원·검토", desc: "생성·검토 (게재 ✗)" },
};

function roleChipClass(role: Role): string {
  const base = "inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full font-semibold text-[12px] leading-none tracking-[0.006em]";
  const colors: Record<Role, string> = {
    owner: "bg-[rgba(101,65,242,0.12)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]",
    launcher: "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] dark:bg-[rgba(0,102,255,0.18)] dark:text-[#6ea7ff]",
    reviewer: "bg-[var(--w-bg-alternative)] text-[var(--w-fg-strong)] dark:bg-[rgba(255,255,255,0.06)]",
  };
  return `${base} ${colors[role]}`;
}

function roleDotClass(role: Role): string {
  const base = "w-1.5 h-1.5 rounded-full flex-none inline-block";
  const colors: Record<Role, string> = {
    owner: "bg-[var(--w-accent-violet)]",
    launcher: "bg-[var(--w-primary-normal)]",
    reviewer: "bg-[var(--w-fg-alternative)]",
  };
  return `${base} ${colors[role]}`;
}

export default function MembersPage() {
  const router = useRouter();
  const showToast = useToast();
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [roleSubmenuOpen, setRoleSubmenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelegate, setConfirmDelegate] = useState<{ id: string; name: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const members = MOCK_MEMBERS;
  const myId = "u1";

  const filtered = useMemo(() => (roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter)), [members, roleFilter]);
  const roleCounts: Record<Role, number> = {
    owner: members.filter((m) => m.role === "owner").length,
    launcher: members.filter((m) => m.role === "launcher").length,
    reviewer: members.filter((m) => m.role === "reviewer").length,
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-menu-root]")) return;
      setMenuOpen(null);
      setRoleSubmenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="구성원·권한">
      <div className="flex justify-between items-start gap-6">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            className="w-14 h-14 rounded-[14px] text-white grid place-items-center font-extrabold text-[22px] leading-none [font-family:var(--w-font-display)] flex-none"
            style={{ background: WORKSPACE.gradient }}
          >
            {WORKSPACE.initial}
          </div>
          <div>
            <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">워크스페이스 · 구성원·권한</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <h1 className="m-0 mt-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">{WORKSPACE.name}</h1>
              <button
                className="w-8 h-8 rounded-lg border border-transparent bg-transparent text-[var(--w-fg-neutral)] cursor-pointer inline-grid place-items-center hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)] transition-[background,color] duration-[120ms]"
                type="button"
                title="워크스페이스 설정에서 이름·로고 수정"
              >
                <Icon name="settings" size={14} />
              </button>
            </div>
            <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
              멤버 {members.length}명 · 한 사람이 한 워크스페이스에 속해 함께 광고를 운영해요.
            </p>
          </div>
        </div>
        <Button variant="primary" type="button" onClick={() => setInviteOpen(true)}><Icon name="plus" size={14} /> 멤버 초대</Button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setRoleFilter("all")}
          className={cn(
            "inline-flex items-center gap-1.5 py-[7px] px-3 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] font-semibold text-[12.5px] leading-none cursor-pointer hover:bg-[var(--w-bg-neutral)] transition-[background,color,border-color] duration-[120ms]",
            roleFilter === "all" && "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)] hover:bg-[var(--w-fg-neutral)] hover:border-[var(--w-fg-neutral)]"
          )}
        >
          전체 <span className="font-semibold text-[11px] leading-none [font-family:var(--w-font-mono)] ml-1 opacity-70">{members.length}</span>
        </button>
        {(["owner", "launcher", "reviewer"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={cn(
              "inline-flex items-center gap-1.5 py-[7px] px-3 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] font-semibold text-[12.5px] leading-none cursor-pointer hover:bg-[var(--w-bg-neutral)] transition-[background,color,border-color] duration-[120ms]",
              roleFilter === r && "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)] hover:bg-[var(--w-fg-neutral)] hover:border-[var(--w-fg-neutral)]"
            )}
          >
            <span className={roleDotClass(r)} />
            {ROLE_DEF[r].label}
            <span className="font-semibold text-[11px] leading-none [font-family:var(--w-font-mono)] ml-0.5 opacity-70">{roleCounts[r]}</span>
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left">멤버</th>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 220 }}>이메일</th>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 130 }}>역할</th>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 110 }}>상태</th>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 110 }}>합류일</th>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 110 }}>마지막 활동</th>
              <th className="px-4 py-2.5 font-semibold text-[11.5px] leading-none tracking-[0.004em] text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] text-left" style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const isInvited = m.status === "invited";
              const isMe = m.id === myId;
              return (
                <tr
                  key={m.id}
                  className={cn(
                    isInvited
                      ? "[&_td]:bg-[var(--w-bg-alternative)] dark:[&_td]:bg-[rgba(255,255,255,0.03)]"
                      : "group cursor-pointer"
                  )}
                  onClick={isInvited ? undefined : () => router.push(`/members/${m.id}`)}
                >
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)]", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar member={m} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className={cn("font-semibold text-[13.5px] leading-[1.35]", isInvited ? "text-[var(--w-fg-neutral)]" : "text-[var(--w-fg-strong)]")}>{m.name || "—"}</span>
                          {isMe && <span className="font-bold text-[10px] leading-none [font-family:var(--w-font-mono)] bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] py-[3px] px-1.5 rounded-[4px] tracking-[0.04em]">나</span>}
                        </div>
                        {isInvited && <div className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)] mt-1">초대 수락 대기 중</div>}
                      </div>
                    </div>
                  </td>
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)] font-medium text-[12.5px] leading-[1.4] [font-family:var(--w-font-mono)] text-[var(--w-fg-neutral)]", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")}>{m.email}</td>
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)]", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")}><RoleChip role={m.role} /></td>
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)]", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")}><StatusBadge status={m.status} /></td>
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)] font-medium text-[12.5px] leading-none [font-family:var(--w-font-mono)]", isInvited ? "text-[var(--w-fg-alternative)]" : "text-[var(--w-fg-normal)]", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")}>{m.joined || "—"}</td>
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)] font-medium text-[12.5px] leading-none", isInvited ? "text-[var(--w-fg-alternative)]" : "text-[var(--w-fg-neutral)]", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")}>{m.lastActive || "—"}</td>
                  <td className={cn("px-4 py-3 border-b border-[var(--w-line-alternative)] relative", !isInvited && "group-hover:bg-[var(--w-bg-neutral)]")} data-menu-root>
                    {!isMe && (
                      <button
                        className="w-8 h-8 rounded-lg border border-transparent bg-transparent text-[var(--w-fg-neutral)] cursor-pointer inline-grid place-items-center hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)] transition-[background,color] duration-[120ms]"
                        type="button"
                        title="더 보기"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); setRoleSubmenuOpen(false); }}
                      >
                        <Icon name="dots" size={16} />
                      </button>
                    )}
                    {menuOpen === m.id && (
                      isInvited ? (
                        <InvitedMenu
                          onResend={() => { setMenuOpen(null); showToast("초대 메일을 다시 보냈어요"); }}
                          onCancel={() => { setMenuOpen(null); showToast(`${m.email} 초대를 취소했어요`); }}
                        />
                      ) : (
                        <ActiveMenu
                          member={m}
                          submenuOpen={roleSubmenuOpen}
                          setSubmenuOpen={setRoleSubmenuOpen}
                          onChangeRole={(r) => {
                            if (r === "owner") { setConfirmDelegate({ id: m.id, name: m.name ?? m.email }); setMenuOpen(null); }
                            else { setMenuOpen(null); showToast(`${m.name ?? m.email}님 역할을 '${ROLE_DEF[r].label}'(으)로 변경했어요`); }
                          }}
                          onRemove={() => { setConfirmRemove({ id: m.id, name: m.name ?? m.email }); setMenuOpen(null); }}
                        />
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 28 }}>
        <PermissionMatrix />
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onSend={(emails) => { setInviteOpen(false); showToast(`${emails.length}명에게 초대를 보냈어요`); }}
        />
      )}
      {confirmDelegate && (
        <ConfirmModal
          title={`${confirmDelegate.name}님을 팀장으로 위임할까요?`}
          desc="본인은 자동으로 '팀원·게재'로 변경되고, 팀장은 한 명만 가능해요."
          confirmLabel="위임하기"
          tone="primary"
          onClose={() => setConfirmDelegate(null)}
          onConfirm={() => { showToast(`${confirmDelegate.name}님을 팀장으로 위임했어요`); setConfirmDelegate(null); }}
        />
      )}
      {confirmRemove && (
        <ConfirmModal
          title={`${confirmRemove.name}님을 워크스페이스에서 내보낼까요?`}
          desc="만든 캠페인·소재는 워크스페이스에 그대로 남고 작성자는 '(탈퇴한 멤버)'로 표시돼요."
          confirmLabel="내보내기"
          tone="danger"
          onClose={() => setConfirmRemove(null)}
          onConfirm={() => { showToast(`${confirmRemove.name}님을 내보냈어요`); setConfirmRemove(null); }}
        />
      )}
    </div>
  );
}

function Avatar({ member }: { member: Member }) {
  if (member.status === "invited") {
    return (
      <div className="w-9 h-9 rounded-full border-[1.5px] border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] grid place-items-center flex-none">
        <Icon name="message" size={14} />
      </div>
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full text-white grid place-items-center font-bold text-[14px] leading-none [font-family:var(--w-font-display)] flex-none"
      style={{ background: member.avatarBg || "var(--w-fg-neutral)" }}
    >
      {member.name?.[0] ?? "?"}
    </div>
  );
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span className={roleChipClass(role)}>
      <span className={roleDotClass(role)} />
      {ROLE_DEF[role].label}
    </span>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full font-semibold text-[11.5px] leading-none text-[var(--w-status-positive)] bg-[rgba(0,191,64,0.10)] dark:bg-[rgba(73,229,125,0.14)] dark:text-[#49e57d]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--w-status-positive)] dark:bg-[#49e57d]" />
        활성
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full font-semibold text-[11.5px] leading-none text-[var(--w-fg-neutral)] bg-transparent border border-dashed border-[var(--w-line-normal)]">
      <Icon name="clock" size={11} /> 초대됨
    </span>
  );
}

function ActiveMenu({ member, submenuOpen, setSubmenuOpen, onChangeRole, onRemove }: {
  member: Member; submenuOpen: boolean; setSubmenuOpen: (v: boolean) => void; onChangeRole: (r: Role) => void; onRemove: () => void;
}) {
  return (
    <div className="absolute right-2 top-9 z-30 min-w-[220px] p-1.5 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
      <button
        className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent transition-colors duration-[120ms]"
        type="button"
        onClick={() => setSubmenuOpen(!submenuOpen)}
      >
        <Icon name="users" size={14} />
        <span style={{ flex: 1 }}>역할 변경</span>
        <Icon name="chev-down" size={12} style={{ transform: "rotate(-90deg)" }} />
      </button>
      {submenuOpen && (
        <div style={{ padding: "6px 4px 4px", borderTop: "1px solid var(--w-line-alternative)", marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          {(["launcher", "reviewer"] as Role[]).map((r) => (
            <button
              key={r}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent transition-colors duration-[120ms]"
              type="button"
              style={{ paddingLeft: 30 }}
              onClick={() => onChangeRole(r)}
              disabled={member.role === r}
            >
              <span className={roleDotClass(r)} />
              <span style={{ flex: 1 }}>{ROLE_DEF[r].label}</span>
              {member.role === r && <Icon name="check" size={12} />}
            </button>
          ))}
          <button
            className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent transition-colors duration-[120ms]"
            type="button"
            style={{ paddingLeft: 30, color: "var(--w-primary-press)" }}
            onClick={() => onChangeRole("owner")}
          >
            <Icon name="asterisk" size={12} />
            <span style={{ flex: 1 }}>팀장으로 위임</span>
          </button>
        </div>
      )}
      <div className="h-px bg-[var(--w-line-alternative)] mx-1 my-1" />
      <button
        className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-status-negative)] hover:bg-[rgba(255,66,66,0.08)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent transition-colors duration-[120ms]"
        type="button"
        onClick={onRemove}
      >
        <Icon name="logout" size={14} />
        <span>워크스페이스에서 내보내기</span>
      </button>
    </div>
  );
}

function InvitedMenu({ onResend, onCancel }: { onResend: () => void; onCancel: () => void }) {
  return (
    <div className="absolute right-2 top-9 z-30 min-w-[220px] p-1.5 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
      <button
        className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent transition-colors duration-[120ms]"
        type="button"
        onClick={onResend}
      >
        <Icon name="refresh" size={14} /> <span>초대 재발송</span>
      </button>
      <div className="h-px bg-[var(--w-line-alternative)] mx-1 my-1" />
      <button
        className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border-none cursor-pointer rounded-lg text-left font-medium text-[13px] leading-none text-[var(--w-status-negative)] hover:bg-[rgba(255,66,66,0.08)] disabled:text-[var(--w-fg-alternative)] disabled:cursor-default disabled:hover:bg-transparent transition-colors duration-[120ms]"
        type="button"
        onClick={onCancel}
      >
        <Icon name="x" size={14} /> <span>초대 취소</span>
      </button>
    </div>
  );
}

function InviteModal({ onClose, onSend }: { onClose: () => void; onSend: (emails: string[], role: Role) => void }) {
  const [emails, setEmails] = useState<string[]>(["partner@greenroutine.co"]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<Role>("launcher");

  const addEmail = () => {
    const v = draft.trim().replace(/,$/, "");
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
    setEmails((es) => [...es, v]);
    setDraft("");
  };

  return (
    <ModalShell onClose={onClose} width={560}>
      <div className="flex items-center justify-between p-6 pb-0">
        <h3 className="font-bold text-[17px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.01em] m-0">멤버 초대</h3>
        <button
          className="w-8 h-8 rounded-lg border border-transparent bg-transparent text-[var(--w-fg-neutral)] cursor-pointer inline-grid place-items-center hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)] transition-[background,color] duration-[120ms]"
          type="button"
          onClick={onClose}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div style={{ padding: "20px 24px 8px" }}>
        <div className="font-semibold text-[11px] leading-none tracking-[0.04em] uppercase text-[var(--w-fg-strong)] mb-2">이메일</div>
        <div className="flex flex-wrap gap-1.5 p-2 px-2.5 border border-[var(--w-line-normal)] rounded-[10px] bg-[var(--w-bg-elevated)] min-h-[44px] focus-within:border-[var(--w-primary-normal)] focus-within:shadow-[0_0_0_3px_rgba(0,102,255,0.10)]">
          {emails.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-1 bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] rounded-[6px] font-semibold text-[12px] leading-none [font-family:var(--w-font-mono)]">
              {e}
              <button
                type="button"
                className="w-[18px] h-[18px] border-none bg-transparent text-[var(--w-primary-press)] grid place-items-center cursor-pointer rounded-[4px] hover:bg-[rgba(0,102,255,0.15)]"
                onClick={() => setEmails((es) => es.filter((_, idx) => idx !== i))}
              >
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
          <input
            className="flex-1 min-w-[140px] border-none outline-none bg-transparent font-medium text-[13px] leading-none text-[var(--w-fg-strong)]"
            placeholder={emails.length ? "" : "name@company.com"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEmail(); }
              if (e.key === "Backspace" && !draft && emails.length) setEmails((es) => es.slice(0, -1));
            }}
            onBlur={addEmail}
          />
        </div>
        <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)] mt-1.5">회사 Google(gmail) 이메일이어야 해요. 엔터나 쉼표로 여러 명을 추가할 수 있어요.</div>
      </div>
      <div style={{ padding: "16px 24px 4px" }}>
        <div className="font-semibold text-[11px] leading-none tracking-[0.04em] uppercase text-[var(--w-fg-strong)] mb-2">역할</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["launcher", "reviewer"] as Role[]).map((r) => (
            <label
              key={r}
              className={cn(
                "flex items-start gap-2.5 p-3.5 border border-[var(--w-line-normal)] rounded-xl cursor-pointer transition-[border-color,background] duration-[120ms] hover:border-[var(--w-line-strong)]",
                role === r && "border-[var(--w-primary-normal)] bg-[rgba(0,102,255,0.03)]"
              )}
            >
              <input className="hidden" type="radio" name="invite-role" checked={role === r} onChange={() => setRole(r)} />
              <span className={cn(roleDotClass(r), "w-2 h-2")} />
              <div style={{ flex: 1 }}>
                <div className="font-semibold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)]">{ROLE_DEF[r].label}</div>
                <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] mt-[3px]">
                  {r === "launcher" ? "캠페인 생성·검토·실제 게재까지 가능해요." : "캠페인 생성·검토는 가능하지만 게재는 팀장/팀원·게재가 처리해요."}
                </div>
              </div>
              <span
                className={cn(
                  "w-[18px] h-[18px] rounded-full border-[1.5px] border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] flex-none mt-0.5 grid place-items-center text-white",
                  role === r && "bg-[var(--w-primary-normal)] border-[var(--w-primary-normal)]"
                )}
              >
                {role === r && <Icon name="check" size={10} strokeWidth={3} />}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="px-6 pt-4 pb-0 font-medium text-[12px] leading-[1.55] text-[var(--w-fg-neutral)]">
        <Icon name="info" size={12} style={{ verticalAlign: -1, marginRight: 4, color: "var(--w-fg-alternative)" }} />
        초대 메일의 링크에서 Google 로그인하면 합류해요. 초대한 이메일과 로그인 계정이 같아야 해요.
      </div>
      <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
        <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
        <Button variant="primary" type="button" onClick={() => onSend(emails, role)} disabled={!emails.length}>
          초대 보내기 {emails.length > 0 && `(${emails.length})`}
        </Button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, desc, confirmLabel, tone, onClose, onConfirm }: {
  title: string; desc: string; confirmLabel: string; tone: "primary" | "danger"; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onClose} width={460}>
      <div style={{ padding: "26px 26px 8px" }}>
        <div
          className="w-11 h-11 rounded-xl grid place-items-center mb-[14px]"
          style={{
            background: tone === "danger" ? "rgba(255,66,66,0.10)" : "var(--w-primary-soft)",
            color: tone === "danger" ? "var(--w-status-negative)" : "var(--w-primary-press)",
          }}
        >
          <Icon name={tone === "danger" ? "warn" : "asterisk"} size={20} />
        </div>
        <h3 className="font-bold text-[17px] leading-[1.35] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.01em] m-0">{title}</h3>
        <p className="font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-neutral)] mt-2.5 mb-0">{desc}</p>
      </div>
      <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
        <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} type="button" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, width = 480 }: { children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]" onClick={onClose}>
      <div
        className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease]"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const PERM_ROWS: { label: string; o: "y" | "n"; l: "y" | "n"; r: "y" | "n"; note?: string; highlight?: boolean }[] = [
  { label: "캠페인 생성·편집", o: "y", l: "y", r: "y" },
  { label: "검토·코멘트", o: "y", l: "y", r: "y" },
  { label: "게재·승인", o: "y", l: "y", r: "n", note: "검토 요청만", highlight: true },
  { label: "집행 중 캠페인 제어", o: "y", l: "y", r: "n" },
  { label: "성과 조회", o: "y", l: "y", r: "y" },
  { label: "소재 라이브러리", o: "y", l: "y", r: "y" },
  { label: "멤버 관리", o: "y", l: "n", r: "n" },
  { label: "Meta 광고 계정 연결", o: "y", l: "n", r: "n" },
  { label: "워크스페이스 설정", o: "y", l: "n", r: "n" },
];

function PermissionMatrix() {
  return (
    <Card className="p-0 overflow-hidden">
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--w-line-alternative)" }}>
        <h3 className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] m-0 mb-1">역할별 권한 안내</h3>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">각 역할이 어떤 작업을 할 수 있는지 확인하세요. &ldquo;게재&rdquo;는 실제 Meta에 광고를 올리는 행위예요.</p>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left tracking-[0.06em] uppercase text-[11px] px-3.5 py-3.5 font-semibold leading-none text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">권한 항목</th>
            <th className="text-center px-3.5 py-3.5 font-semibold text-[11.5px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
              <span className="inline-flex items-center gap-[7px] font-semibold text-[12.5px] leading-none text-[var(--w-fg-strong)] tracking-[-0.003em] normal-case">
                <span className={roleDotClass("owner")} />팀장
              </span>
            </th>
            <th className="text-center px-3.5 py-3.5 font-semibold text-[11.5px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
              <span className="inline-flex items-center gap-[7px] font-semibold text-[12.5px] leading-none text-[var(--w-fg-strong)] tracking-[-0.003em] normal-case">
                <span className={roleDotClass("launcher")} />팀원·게재
              </span>
            </th>
            <th className="text-center px-3.5 py-3.5 font-semibold text-[11.5px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
              <span className="inline-flex items-center gap-[7px] font-semibold text-[12.5px] leading-none text-[var(--w-fg-strong)] tracking-[-0.003em] normal-case">
                <span className={roleDotClass("reviewer")} />팀원·검토
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {PERM_ROWS.map((r, i) => (
            <tr
              key={i}
              className={r.highlight ? "bg-[linear-gradient(90deg,rgba(0,102,255,0.04),transparent_40%)] dark:bg-[linear-gradient(90deg,rgba(0,102,255,0.10),transparent_40%)]" : undefined}
            >
              <td className={cn("px-3.5 py-3.5 border-b border-[var(--w-line-alternative)] font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]", i === PERM_ROWS.length - 1 && "border-b-0")}>
                {r.label}
                {r.highlight && (
                  <span className="ml-2 font-semibold text-[10.5px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-primary-press)] bg-[var(--w-primary-soft)] py-[3px] px-1.5 rounded-[4px] tracking-[0.04em]">CORE</span>
                )}
              </td>
              <PermCell v={r.o} last={i === PERM_ROWS.length - 1} />
              <PermCell v={r.l} last={i === PERM_ROWS.length - 1} />
              <PermCell v={r.r} note={r.note} last={i === PERM_ROWS.length - 1} />
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PermCell({ v, note, last }: { v: "y" | "n"; note?: string; last?: boolean }) {
  const tdClass = cn("px-3.5 py-3.5 border-b border-[var(--w-line-alternative)] text-center align-top", last && "border-b-0");
  if (v === "y") {
    return (
      <td className={tdClass}>
        <span className="inline-grid place-items-center w-[22px] h-[22px] rounded-[6px] bg-[rgba(0,191,64,0.12)] text-[var(--w-status-positive)] dark:bg-[rgba(73,229,125,0.16)] dark:text-[#49e57d]">
          <Icon name="check" size={13} strokeWidth={3} />
        </span>
      </td>
    );
  }
  return (
    <td className={tdClass}>
      <span className="inline-grid place-items-center w-[22px] h-[22px] rounded-[6px] bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] dark:bg-[rgba(255,255,255,0.06)]">
        <Icon name="x" size={12} strokeWidth={2.5} />
      </span>
      {note && <div className="font-medium text-[11px] leading-[1.3] text-[var(--w-fg-alternative)] mt-1">{note}</div>}
    </td>
  );
}
