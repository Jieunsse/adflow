"use client";

// ADR-033 — Browse Mode Presenter Console 의 공통 껍데기 + atom. 오른쪽 거터에 세로(가로:세로 ~1:1.6)로 앉는다.
// 거터 = (100vw - 248 sidebar - 1280 content)/2 — ~1528px 미만이면 거터가 사라져 right:16px 로 clamp(본문 근접).
// 데모 전용. 각 페이지 Presenter 바는 body/actions 만 채운다.

import Icon, { type IconName } from "@shared/ui/Icon";

// 거터 중앙에 폭 240 패널을 앉히는 right 오프셋(120 = 폭/2). 거터가 좁아지면 16px 로 clamp.
const RIGHT = "max(16px, calc((100vw - 1528px) / 4 - 120px))";

export function PresenterConsoleShell({
  body,
  actions,
}: {
  body: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div
      className="fixed top-1/2 -translate-y-1/2 z-[90] flex w-[240px] flex-col overflow-hidden rounded-2xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)] shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
      style={{ right: RIGHT }}
    >
      <div className="flex items-center gap-1.5 px-5 pt-4 pb-3.5 border-b border-[var(--w-line-neutral)]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[12px] text-[var(--w-fg-neutral)]">
          <Icon name="play" size={14} /> 발표자 빨리감기
        </span>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{body}</div>
      <div className="flex flex-col gap-2 px-5 pb-5">{actions}</div>
    </div>
  );
}

export function ConsoleBigNumber({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-[var(--w-fg-alternative)] mb-1.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[40px] font-bold leading-none tracking-[-0.02em] text-[var(--w-fg-strong)]">{value}</span>
        {unit && <span className="text-[15px] font-semibold text-[var(--w-fg-neutral)]">{unit}</span>}
      </div>
    </div>
  );
}

export function ConsoleStatGrid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-[var(--w-bg-neutral)] py-3 text-center">
          <div className="text-[20px] font-bold text-[var(--w-fg-strong)] leading-none">{v}</div>
          <div className="text-[11px] font-medium text-[var(--w-fg-alternative)] mt-1.5">{k}</div>
        </div>
      ))}
    </div>
  );
}

export function ConsoleInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--w-bg-neutral)] px-4 py-3.5 flex items-center justify-between">
      <span className="text-[12px] font-medium text-[var(--w-fg-alternative)]">{label}</span>
      <span className="text-[17px] font-bold text-[var(--w-fg-strong)]">{value}</span>
    </div>
  );
}

export function ConsoleStatusBadge({ ok, icon, children }: { ok: boolean; icon: IconName; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-semibold text-[13px]"
      style={{ color: ok ? "var(--w-status-positive)" : "var(--w-fg-alternative)" }}
    >
      <Icon name={icon} size={14} />
      {children}
    </span>
  );
}
