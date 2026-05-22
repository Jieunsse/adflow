"use client";

import { useState } from "react";
import { maskId } from "@shared/lib/format";
import { useToast } from "@shared/ui/Toast";
import Icon from "@shared/ui/Icon";

type Props = {
  label: string;
  id: string | null | undefined;
  desc?: string;
};

export default function IdField({ label, id, desc }: Props) {
  const showToast = useToast();
  const [revealed, setRevealed] = useState(false);
  const valid = !!id && id !== "—";
  const display = !valid ? "—" : revealed ? id : maskId(id);

  const handleCopy = async () => {
    if (!valid) return;
    try {
      await navigator.clipboard.writeText(id!);
      showToast("ID를 복사했어요");
    } catch {
      showToast("복사하지 못했어요");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">
        <span className="font-semibold text-[12px] leading-none tracking-[0.008em] text-[var(--w-fg-neutral)] flex-none">{label}</span>
        <span className="flex-1 font-medium text-[13px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{display}</span>
        {valid && (
          <div className="flex items-center gap-0.5 flex-none">
            <button
              type="button"
              className="w-7 h-7 rounded-lg grid place-items-center text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] transition-colors duration-[120ms] border-none bg-transparent cursor-pointer"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "ID 숨기기" : "ID 확인하기"}
              title={revealed ? "숨기기" : "확인하기"}
            >
              <Icon name={revealed ? "eye-off" : "eye"} size={14} />
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-lg grid place-items-center text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] transition-colors duration-[120ms] border-none bg-transparent cursor-pointer"
              onClick={handleCopy}
              aria-label="ID 복사"
              title="ID 복사"
            >
              <Icon name="copy" size={14} />
            </button>
          </div>
        )}
      </div>
      {desc && <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">{desc}</div>}
    </div>
  );
}
