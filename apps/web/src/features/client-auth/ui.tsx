"use client";

// 고객 가입·로그인 화면 공통 부품. 로그인 전 화면이라 워크스페이스 레이아웃 없이 가운데 카드 하나로 둔다.

import type { ReactNode } from "react";

export const INPUT =
  "w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] font-medium text-[var(--w-fg-strong)] bg-[var(--w-bg-elevated)]";

export function AuthCard({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="adflow min-h-screen grid place-items-center px-4 py-12 [background:var(--w-bg-alternative)] [color-scheme:light]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-8 flex flex-col gap-5">
        <div>
          <h1 className="m-0 font-bold text-[22px] text-[var(--w-fg-strong)]">{title}</h1>
          {desc && <p className="m-0 mt-2 font-medium text-[14px] leading-[1.6] text-[var(--w-fg-neutral)]">{desc}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-[13px] text-[var(--w-fg-strong)]">{label}</label>
      {children}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg px-3.5 py-3 font-medium text-[13px] leading-[1.5] ${
        tone === "error" ? "bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)]" : "bg-[var(--w-primary-soft)] text-[var(--w-fg-strong)]"
      }`}
    >
      {children}
    </div>
  );
}

/** 로그인 전 화면의 요청. 서버 문구({"error"})를 그대로 돌려준다. */
export async function postAuth(action: string, body: unknown): Promise<string | null> {
  const res = await fetch(`/api/client-auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return null;
  const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
  return data?.error ?? "요청을 처리하지 못했어요. 잠시 뒤 다시 해 주세요.";
}
