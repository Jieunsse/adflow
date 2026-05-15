"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Icon from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";

type Role = "owner" | "launcher" | "reviewer";
type MemberStatus = "active" | "invited";
interface Member {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: MemberStatus;
  joined: string | null;
  lastActive: string | null;
  avatarBg: string | null;
}

const WORKSPACE = { name: "애드플로우 마케팅팀", initial: "애", gradient: "linear-gradient(135deg,#0066ff,#6541f2)" };

const FULL_MEMBERS: Member[] = [
  { id: "u1", name: "Jayden Ock", email: "jieunsse@gmail.com", role: "owner", status: "active", joined: "2025-05-11", lastActive: "방금 전", avatarBg: "#ff7a59" },
  { id: "u2", name: "박서윤", email: "seoyoon@cold.kr", role: "launcher", status: "active", joined: "2024-12-03", lastActive: "12분 전", avatarBg: "#0066ff" },
  { id: "u3", name: "이도현", email: "dohyun@cold.kr", role: "launcher", status: "active", joined: "2025-01-20", lastActive: "1시간 전", avatarBg: "#008a2e" },
  { id: "u4", name: "정민서", email: "minseo@cold.kr", role: "launcher", status: "active", joined: "2025-02-08", lastActive: "어제", avatarBg: "#c2185b" },
  { id: "u5", name: "김하늘", email: "haneul@cold.kr", role: "reviewer", status: "active", joined: "2025-03-15", lastActive: "어제", avatarBg: "#6541f2" },
  { id: "u6", name: "오현우", email: "hyunwoo@cold.kr", role: "reviewer", status: "active", joined: "2025-04-02", lastActive: "3일 전", avatarBg: "#9c5800" },
  { id: "i1", name: null, email: "newbie@cold.kr", role: "launcher", status: "invited", joined: null, lastActive: null, avatarBg: null },
  { id: "i2", name: null, email: "intern@cold.kr", role: "reviewer", status: "invited", joined: null, lastActive: null, avatarBg: null },
];

const ROLE_DEF: Record<Role, { label: string; chipClass: string; desc: string }> = {
  owner: { label: "팀장", chipClass: "role-chip role-chip--owner", desc: "모든 권한" },
  launcher: { label: "팀원·게재", chipClass: "role-chip role-chip--launcher", desc: "생성·검토·게재" },
  reviewer: { label: "팀원·검토", chipClass: "role-chip role-chip--reviewer", desc: "생성·검토 (게재 ✗)" },
};

export default function MembersPage() {
  const showToast = useToast();
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [roleSubmenuOpen, setRoleSubmenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelegate, setConfirmDelegate] = useState<{ id: string; name: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const members = FULL_MEMBERS;
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
    <div className="page" data-screen-label="구성원·권한">
      <div className="page__head" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: WORKSPACE.gradient, color: "#fff", display: "grid", placeItems: "center", font: "800 22px/1 var(--w-font-display)", flex: "0 0 auto" }}>{WORKSPACE.initial}</div>
          <div>
            <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>워크스페이스 · 구성원·권한</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <h1 className="page__title" style={{ marginTop: 0 }}>{WORKSPACE.name}</h1>
              <button className="icon-btn" type="button" title="워크스페이스 설정에서 이름·로고 수정"><Icon name="settings" size={14} /></button>
            </div>
            <p className="page__sub">멤버 {members.length}명 · 한 사람이 한 워크스페이스에 속해 함께 광고를 운영해요.</p>
          </div>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => setInviteOpen(true)}><Icon name="plus" size={14} /> 멤버 초대</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={() => setRoleFilter("all")} className={"filter-chip" + (roleFilter === "all" ? " filter-chip--on" : "")}>
          전체 <span style={{ font: "600 11px/1 var(--w-font-mono)", marginLeft: 4, opacity: 0.7 }}>{members.length}</span>
        </button>
        {(["owner", "launcher", "reviewer"] as Role[]).map((r) => (
          <button key={r} type="button" onClick={() => setRoleFilter(r)} className={"filter-chip" + (roleFilter === r ? " filter-chip--on" : "")}>
            <span className={`role-dot role-dot--${r}`} />
            {ROLE_DEF[r].label}
            <span style={{ font: "600 11px/1 var(--w-font-mono)", marginLeft: 2, opacity: 0.7 }}>{roleCounts[r]}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>멤버</th>
              <th style={{ width: 220 }}>이메일</th>
              <th style={{ width: 130 }}>역할</th>
              <th style={{ width: 110 }}>상태</th>
              <th style={{ width: 110 }}>합류일</th>
              <th style={{ width: 110 }}>마지막 활동</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const isInvited = m.status === "invited";
              const isMe = m.id === myId;
              return (
                <tr key={m.id} className={"dtable__row" + (isInvited ? " dtable__row--dim" : "")}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar member={m} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ font: "600 13.5px/1.35 var(--w-font-sans)", color: isInvited ? "var(--w-fg-neutral)" : "var(--w-fg-strong)" }}>{m.name || "—"}</span>
                          {isMe && <span className="me-pill">나</span>}
                        </div>
                        {isInvited && <div style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginTop: 4 }}>초대 수락 대기 중</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ font: "500 12.5px/1.4 var(--w-font-mono)", color: "var(--w-fg-neutral)" }}>{m.email}</td>
                  <td><RoleChip role={m.role} /></td>
                  <td><StatusBadge status={m.status} /></td>
                  <td style={{ font: "500 12.5px/1 var(--w-font-mono)", color: isInvited ? "var(--w-fg-alternative)" : "var(--w-fg-normal)" }}>{m.joined || "—"}</td>
                  <td style={{ font: "500 12.5px/1 var(--w-font-sans)", color: isInvited ? "var(--w-fg-alternative)" : "var(--w-fg-neutral)" }}>{m.lastActive || "—"}</td>
                  <td data-menu-root style={{ position: "relative" }}>
                    {!isMe && (
                      <button className="icon-btn" type="button" title="더 보기" onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); setRoleSubmenuOpen(false); }}>
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
      </div>

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
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px dashed var(--w-line-normal)", background: "var(--w-bg-alternative)", color: "var(--w-fg-alternative)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name="message" size={14} />
      </div>
    );
  }
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: member.avatarBg || "var(--w-fg-neutral)", color: "#fff", display: "grid", placeItems: "center", font: "700 14px/1 var(--w-font-display)", flex: "0 0 auto" }}>
      {member.name?.[0] ?? "?"}
    </div>
  );
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span className={ROLE_DEF[role].chipClass}>
      <span className={`role-dot role-dot--${role}`} />
      {ROLE_DEF[role].label}
    </span>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  if (status === "active") {
    return <span className="status-badge status-badge--active"><span className="status-dot" /> 활성</span>;
  }
  return <span className="status-badge status-badge--invited"><Icon name="clock" size={11} /> 초대됨</span>;
}

function ActiveMenu({ member, submenuOpen, setSubmenuOpen, onChangeRole, onRemove }: {
  member: Member; submenuOpen: boolean; setSubmenuOpen: (v: boolean) => void; onChangeRole: (r: Role) => void; onRemove: () => void;
}) {
  return (
    <div className="row-menu" onClick={(e) => e.stopPropagation()}>
      <button className="row-menu__item" type="button" onClick={() => setSubmenuOpen(!submenuOpen)}>
        <Icon name="users" size={14} />
        <span style={{ flex: 1 }}>역할 변경</span>
        <Icon name="chev-down" size={12} style={{ transform: "rotate(-90deg)" }} />
      </button>
      {submenuOpen && (
        <div style={{ padding: "6px 4px 4px", borderTop: "1px solid var(--w-line-alternative)", marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          {(["launcher", "reviewer"] as Role[]).map((r) => (
            <button key={r} className="row-menu__item" type="button" style={{ paddingLeft: 30 }} onClick={() => onChangeRole(r)} disabled={member.role === r}>
              <span className={`role-dot role-dot--${r}`} />
              <span style={{ flex: 1 }}>{ROLE_DEF[r].label}</span>
              {member.role === r && <Icon name="check" size={12} />}
            </button>
          ))}
          <button className="row-menu__item" type="button" style={{ paddingLeft: 30, color: "var(--w-primary-press)" }} onClick={() => onChangeRole("owner")}>
            <Icon name="asterisk" size={12} />
            <span style={{ flex: 1 }}>팀장으로 위임</span>
          </button>
        </div>
      )}
      <div className="row-menu__divider" />
      <button className="row-menu__item row-menu__item--danger" type="button" onClick={onRemove}>
        <Icon name="logout" size={14} />
        <span>워크스페이스에서 내보내기</span>
      </button>
    </div>
  );
}

function InvitedMenu({ onResend, onCancel }: { onResend: () => void; onCancel: () => void }) {
  return (
    <div className="row-menu" onClick={(e) => e.stopPropagation()}>
      <button className="row-menu__item" type="button" onClick={onResend}><Icon name="refresh" size={14} /> <span>초대 재발송</span></button>
      <div className="row-menu__divider" />
      <button className="row-menu__item row-menu__item--danger" type="button" onClick={onCancel}><Icon name="x" size={14} /> <span>초대 취소</span></button>
    </div>
  );
}

function InviteModal({ onClose, onSend }: { onClose: () => void; onSend: (emails: string[], role: Role) => void }) {
  const [emails, setEmails] = useState<string[]>(["partner@cold.kr"]);
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
      <div className="modal__head">
        <h3 className="modal__title">멤버 초대</h3>
        <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
      </div>
      <div style={{ padding: "20px 24px 8px" }}>
        <div className="field__label">이메일</div>
        <div className="chip-input">
          {emails.map((e, i) => (
            <span key={i} className="email-chip">
              {e}
              <button type="button" onClick={() => setEmails((es) => es.filter((_, idx) => idx !== i))}><Icon name="x" size={10} /></button>
            </span>
          ))}
          <input
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
        <div className="field__hint" style={{ marginTop: 6 }}>회사 Google(gmail) 이메일이어야 해요. 엔터나 쉼표로 여러 명을 추가할 수 있어요.</div>
      </div>
      <div style={{ padding: "16px 24px 4px" }}>
        <div className="field__label">역할</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["launcher", "reviewer"] as Role[]).map((r) => (
            <label key={r} className={"role-radio" + (role === r ? " role-radio--on" : "")}>
              <input type="radio" name="invite-role" checked={role === r} onChange={() => setRole(r)} />
              <span className={`role-dot role-dot--${r}`} style={{ width: 8, height: 8 }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{ROLE_DEF[r].label}</div>
                <div style={{ font: "500 12px/1.4 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3 }}>
                  {r === "launcher" ? "캠페인 생성·검토·실제 게재까지 가능해요." : "캠페인 생성·검토는 가능하지만 게재는 팀장/팀원·게재가 처리해요."}
                </div>
              </div>
              <span className={`radio-mark${role === r ? " radio-mark--on" : ""}`}>{role === r && <Icon name="check" size={10} strokeWidth={3} />}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 24px 0", font: "500 12px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
        <Icon name="info" size={12} style={{ verticalAlign: -1, marginRight: 4, color: "var(--w-fg-alternative)" }} />
        초대 메일의 링크에서 Google 로그인하면 합류해요. 초대한 이메일과 로그인 계정이 같아야 해요.
      </div>
      <div className="modal__foot">
        <button className="btn btn--ghost" type="button" onClick={onClose}>취소</button>
        <button className="btn btn--primary" type="button" onClick={() => onSend(emails, role)} disabled={!emails.length}>
          초대 보내기 {emails.length > 0 && `(${emails.length})`}
        </button>
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
        <div style={{ width: 44, height: 44, borderRadius: 12, background: tone === "danger" ? "rgba(255,66,66,0.10)" : "var(--w-primary-soft)", color: tone === "danger" ? "var(--w-status-negative)" : "var(--w-primary-press)", display: "grid", placeItems: "center", marginBottom: 14 }}>
          <Icon name={tone === "danger" ? "warn" : "asterisk"} size={20} />
        </div>
        <h3 style={{ font: "700 17px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em", margin: 0 }}>{title}</h3>
        <p style={{ font: "500 13.5px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 0" }}>{desc}</p>
      </div>
      <div className="modal__foot">
        <button className="btn btn--ghost" type="button" onClick={onClose}>취소</button>
        <button className={"btn " + (tone === "danger" ? "btn--danger" : "btn--primary")} type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, width = 480 }: { children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()}>{children}</div>
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
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--w-line-alternative)" }}>
        <h3 className="section-title" style={{ marginBottom: 4 }}>역할별 권한 안내</h3>
        <p className="section-sub" style={{ marginBottom: 0 }}>각 역할이 어떤 작업을 할 수 있는지 확인하세요. &ldquo;게재&rdquo;는 실제 Meta에 광고를 올리는 행위예요.</p>
      </div>
      <table className="perm-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>권한 항목</th>
            <th><span className="perm-th"><span className="role-dot role-dot--owner" />팀장</span></th>
            <th><span className="perm-th"><span className="role-dot role-dot--launcher" />팀원·게재</span></th>
            <th><span className="perm-th"><span className="role-dot role-dot--reviewer" />팀원·검토</span></th>
          </tr>
        </thead>
        <tbody>
          {PERM_ROWS.map((r, i) => (
            <tr key={i} className={r.highlight ? "perm-row perm-row--hi" : "perm-row"}>
              <td style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                {r.label}
                {r.highlight && <span style={{ marginLeft: 8, font: "600 10.5px/1 var(--w-font-mono)", color: "var(--w-primary-press)", background: "var(--w-primary-soft)", padding: "3px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>CORE</span>}
              </td>
              <PermCell v={r.o} />
              <PermCell v={r.l} />
              <PermCell v={r.r} note={r.note} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermCell({ v, note }: { v: "y" | "n"; note?: string }) {
  if (v === "y") {
    return <td className="perm-cell perm-cell--y"><span className="perm-mark perm-mark--y"><Icon name="check" size={13} strokeWidth={3} /></span></td>;
  }
  return (
    <td className="perm-cell">
      <span className="perm-mark perm-mark--n"><Icon name="x" size={12} strokeWidth={2.5} /></span>
      {note && <div style={{ font: "500 11px/1.3 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginTop: 4 }}>{note}</div>}
    </td>
  );
}
