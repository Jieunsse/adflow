"use client";

import { useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import type { CopyReference } from "@features/brand-profile/model/useBrandProfileStorage";
import IgImportModal from "./IgImportModal";

interface Props {
  refs: CopyReference[];
  canEdit: boolean;
  onSave: (refs: CopyReference[]) => void;
}

const TEXTAREA_CLS =
  "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y";

export default function CopyReferenceSection({ refs, canEdit, onSave }: Props) {
  const [showIgModal, setShowIgModal] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");

  const addRefs = (texts: string[], source: "ig" | "manual") => {
    const newRefs: CopyReference[] = texts
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({
        id: crypto.randomUUID(),
        text,
        source,
        createdAt: new Date().toISOString(),
      }));
    onSave([...refs, ...newRefs]);
  };

  const handleManualAdd = () => {
    const lines = manualText
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    addRefs(lines, "manual");
    setManualText("");
    setShowManual(false);
  };

  const remove = (id: string) => {
    onSave(refs.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[13px] text-[var(--w-fg-neutral)]">
            카피 레퍼런스
          </span>
          <span className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]">
            AI 카피 생성 시 문체·톤 모사의 few-shot 예시로 쓰여요
          </span>
        </div>
        {canEdit && (
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowIgModal(true)}
              className="inline-flex items-center gap-1 px-[10px] py-1.5 rounded-lg border border-[var(--w-line-normal)] font-medium text-[12px] text-[var(--w-fg-neutral)] hover:border-[var(--w-fg-normal)] hover:text-[var(--w-fg-strong)] transition-colors duration-[120ms]"
            >
              <Icon name="instagram" size={12} /> IG에서 가져오기
            </button>
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="inline-flex items-center gap-1 px-[10px] py-1.5 rounded-lg border border-[var(--w-line-normal)] font-medium text-[12px] text-[var(--w-fg-neutral)] hover:border-[var(--w-fg-normal)] hover:text-[var(--w-fg-strong)] transition-colors duration-[120ms]"
            >
              <Icon name="plus" size={12} /> 직접 추가
            </button>
          </div>
        )}
      </div>

      {showManual && (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            className={cn(TEXTAREA_CLS, "min-h-[96px]")}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={"카피를 붙여넣으세요. 빈 줄로 구분하면 여러 건으로 저장돼요.\n\n예) 지금 바로 확인하세요 — 3초 만에 피부가 달라져요\n\n봄 한정 20% 할인, 오늘이 마지막이에요"}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" type="button" onClick={() => { setShowManual(false); setManualText(""); }}>취소</Button>
            <Button variant="primary" size="sm" type="button" onClick={handleManualAdd} disabled={!manualText.trim()}>추가</Button>
          </div>
        </div>
      )}

      {refs.length > 0 ? (
        <div className="flex flex-col gap-2">
          {refs.map((ref) => (
            <div
              key={ref.id}
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)]"
            >
              <div className="flex-1 min-w-0">
                <p className="m-0 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] break-words">
                  {ref.text}
                </p>
                <span className="font-medium text-[11px] text-[var(--w-fg-alternative)]">
                  {ref.source === "ig" ? "IG" : "직접 입력"}
                </span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-[rgba(0,0,0,0.06)] transition-colors"
                  onClick={() => remove(ref.id)}
                >
                  <Icon name="x" size={12} style={{ color: "var(--w-fg-alternative)" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 font-medium text-[13px] text-[var(--w-fg-alternative)] italic">
          {canEdit ? "아직 등록된 카피 레퍼런스가 없어요" : "미등록"}
        </p>
      )}

      {showIgModal && (
        <IgImportModal
          onImport={(texts) => addRefs(texts, "ig")}
          onClose={() => setShowIgModal(false)}
        />
      )}
    </div>
  );
}
