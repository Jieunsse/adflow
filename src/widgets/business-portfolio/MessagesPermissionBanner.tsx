"use client";

import Icon from "@shared/ui/Icon";

export default function MessagesPermissionBanner() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
      <div className="w-9 h-9 rounded-[10px] grid place-items-center flex-none bg-[rgba(255,146,0,0.12)] text-[var(--w-status-cautionary)]">
        <Icon name="warn" size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          style={{
            font: "600 13.5px/1.4 var(--w-font-sans)",
            color: "var(--w-fg-strong)",
          }}
        >
          메시지 권한 미연결 — 샘플 데이터 표시 중
        </div>
        <div
          style={{
            font: "500 12px/1.5 var(--w-font-sans)",
            color: "var(--w-fg-neutral)",
            marginTop: 2,
          }}
        >
          Meta App Review 통과 후 실제 DM 이 보여요.
        </div>
      </div>
      <a
        href="/api/auth/signin"
        className="text-[12.5px] font-semibold text-[var(--w-primary-normal)] no-underline whitespace-nowrap"
      >
        다시 연결 →
      </a>
    </div>
  );
}
