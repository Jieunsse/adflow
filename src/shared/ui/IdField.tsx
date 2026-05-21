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
    <div className="id-field">
      <div className="id-field__row">
        <span className="id-field__label">{label}</span>
        <span className="id-field__value">{display}</span>
        {valid && (
          <div className="id-field__actions">
            <button
              type="button"
              className="id-field__btn"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "ID 숨기기" : "ID 확인하기"}
              title={revealed ? "숨기기" : "확인하기"}
            >
              <Icon name={revealed ? "eye-off" : "eye"} size={14} />
            </button>
            <button
              type="button"
              className="id-field__btn"
              onClick={handleCopy}
              aria-label="ID 복사"
              title="ID 복사"
            >
              <Icon name="copy" size={14} />
            </button>
          </div>
        )}
      </div>
      {desc && <div className="id-field__desc">{desc}</div>}
    </div>
  );
}
