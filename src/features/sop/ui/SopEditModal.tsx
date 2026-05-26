"use client";

import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import {
  isSectionFilled,
  type CtaRestrictionsData,
  type FreeTextData,
  type FreeTextSopType,
  type LengthLimitsData,
  type ProhibitedWordsData,
  type SopItemType,
  type SopSection,
} from "@features/sop/model/useSopStorage";
import { SOP_FREETEXT_PLACEHOLDER, SOP_SECTION_LABEL } from "@features/sop/model/section-labels";
import { SECTION_ACCENT, SECTION_ICON } from "./section-style";

type IconName = Parameters<typeof Icon>[0]["name"];

interface SopEditModalProps {
  type: SopItemType;
  section?: SopSection;
  onClose: () => void;
  onSave: (section: SopSection) => void;
  onClear: () => void;
}

export default function SopEditModal({
  type,
  section,
  onClose,
  onSave,
  onClear,
}: SopEditModalProps) {
  const accent = SECTION_ACCENT[type];
  const iconName = SECTION_ICON[type] as IconName;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]"
      onClick={onClose}
    >
      <div
        className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[92vw] max-h-[88vh] overflow-auto animate-[popIn_140ms_ease] w-[520px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-[var(--w-line-alternative)]">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: accent, color: "#fff" }}
          >
            <Icon name={iconName} size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="m-0 font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)] tracking-[-0.008em]">
              {SOP_SECTION_LABEL[type]}
            </h3>
            <div className="font-medium text-[12px] text-[var(--w-fg-neutral)] mt-0.5">
              {section ? "기존 값을 수정해요" : "이 가드레일을 새로 정의해요"}
            </div>
          </div>
        </div>

        <FormBody type={type} section={section} onSave={onSave} onClear={onClear} onClose={onClose} />
      </div>
    </div>
  );
}

function FormBody({
  type,
  section,
  onSave,
  onClear,
  onClose,
}: {
  type: SopItemType;
  section?: SopSection;
  onSave: (section: SopSection) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  if (type === "prohibited_words") {
    return (
      <ProhibitedWordsForm
        initial={(section?.type === "prohibited_words" ? section.data : undefined) ?? { words: [] }}
        onSave={(data) => onSave({ type: "prohibited_words", data, source: "user" })}
        onClear={onClear}
        onClose={onClose}
        hasExisting={!!section}
      />
    );
  }
  if (type === "length_limits") {
    return (
      <LengthLimitsForm
        initial={(section?.type === "length_limits" ? section.data : undefined) ?? {}}
        onSave={(data) => onSave({ type: "length_limits", data, source: "user" })}
        onClear={onClear}
        onClose={onClose}
        hasExisting={!!section}
      />
    );
  }
  if (type === "cta_restrictions") {
    return (
      <CtaRestrictionsForm
        initial={
          (section?.type === "cta_restrictions" ? section.data : undefined) ?? { blacklist: [] }
        }
        onSave={(data) => onSave({ type: "cta_restrictions", data, source: "user" })}
        onClear={onClear}
        onClose={onClose}
        hasExisting={!!section}
      />
    );
  }
  return (
    <FreeTextForm
      type={type as FreeTextSopType}
      initial={
        (section && section.type !== "prohibited_words" && section.type !== "length_limits" && section.type !== "cta_restrictions"
          ? section.data
          : undefined) ?? { text: "" }
      }
      onSave={(data) => onSave({ type: type as FreeTextSopType, data, source: "user" })}
      onClear={onClear}
      onClose={onClose}
      hasExisting={!!section}
    />
  );
}

interface FormShellProps {
  hasExisting: boolean;
  canSave: boolean;
  onClear: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

function FormActions({ hasExisting, canSave, onClear, onClose, onSubmit }: FormShellProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--w-line-alternative)]">
      <div>
        {hasExisting && (
          <Button variant="ghost" type="button" onClick={onClear}>
            <Icon name="x" size={12} /> 비우기
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" type="button" onClick={onClose}>
          취소
        </Button>
        <Button variant="primary" type="button" onClick={onSubmit} disabled={!canSave}>
          저장
        </Button>
      </div>
    </div>
  );
}

function ProhibitedWordsForm({
  initial,
  onSave,
  onClear,
  onClose,
  hasExisting,
}: {
  initial: ProhibitedWordsData;
  onSave: (data: ProhibitedWordsData) => void;
  onClear: () => void;
  onClose: () => void;
  hasExisting: boolean;
}) {
  const [words, setWords] = useState<string[]>(initial.words);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const incoming = draft
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !words.includes(w));
    if (incoming.length === 0) return;
    setWords((prev) => [...prev, ...incoming]);
    setDraft("");
  };

  const remove = (idx: number) => setWords((prev) => prev.filter((_, i) => i !== idx));

  const canSave = words.length > 0;
  const submit = () => onSave({ words });

  return (
    <>
      <div className="px-6 py-5 flex flex-col gap-3">
        <label className="font-semibold text-[12px] text-[var(--w-fg-alternative)] uppercase tracking-[0.06em]">
          금지 단어
        </label>
        <div className="flex flex-wrap gap-1.5 min-h-[44px] border border-[var(--w-line-normal)] rounded-xl px-3 py-2.5 bg-[var(--w-bg)]">
          {words.length === 0 && (
            <span className="font-medium text-[12.5px] text-[var(--w-fg-alternative)] self-center">
              아래 입력란에 단어를 적고 Enter 또는 쉼표로 추가
            </span>
          )}
          {words.map((w, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--w-status-negative)]/12 font-medium text-[12px] leading-none text-[var(--w-status-negative)]"
              style={{ background: "color-mix(in srgb, var(--w-status-negative) 12%, transparent)" }}
            >
              {w}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="삭제"
                className="border-none bg-transparent cursor-pointer p-0 inline-flex items-center text-current opacity-60 hover:opacity-100"
              >
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder="예: 100% 보장, 최고, 1위"
          className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-2.5 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
        />
        <div className="font-medium text-[11.5px] text-[var(--w-fg-alternative)]">
          쉼표 또는 Enter 로 한 단어씩 추가돼요.
        </div>
      </div>
      <FormActions
        hasExisting={hasExisting}
        canSave={canSave}
        onClear={onClear}
        onClose={onClose}
        onSubmit={submit}
      />
    </>
  );
}

function LengthLimitsForm({
  initial,
  onSave,
  onClear,
  onClose,
  hasExisting,
}: {
  initial: LengthLimitsData;
  onSave: (data: LengthLimitsData) => void;
  onClear: () => void;
  onClose: () => void;
  hasExisting: boolean;
}) {
  const [headline, setHeadline] = useState<string>(initial.headline?.toString() ?? "");
  const [body, setBody] = useState<string>(initial.body?.toString() ?? "");
  const [link, setLink] = useState<string>(initial.link?.toString() ?? "");
  const [hashtagCount, setHashtag] = useState<string>(initial.hashtagCount?.toString() ?? "");

  const parsed = {
    headline: parseLimit(headline),
    body: parseLimit(body),
    link: parseLimit(link),
    hashtagCount: parseLimit(hashtagCount),
  };
  const canSave =
    parsed.headline != null ||
    parsed.body != null ||
    parsed.link != null ||
    parsed.hashtagCount != null;

  const submit = () => {
    const data: LengthLimitsData = {};
    if (parsed.headline != null) data.headline = parsed.headline;
    if (parsed.body != null) data.body = parsed.body;
    if (parsed.link != null) data.link = parsed.link;
    if (parsed.hashtagCount != null) data.hashtagCount = parsed.hashtagCount;
    onSave(data);
  };

  return (
    <>
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="font-medium text-[12.5px] text-[var(--w-fg-neutral)] mb-1">
          비워두면 그 항목은 제한 없음으로 처리해요.
        </div>
        <LimitRow label="헤드라인" unit="자" value={headline} onChange={setHeadline} placeholder="예: 40" />
        <LimitRow label="본문 텍스트" unit="자" value={body} onChange={setBody} placeholder="예: 125" />
        <LimitRow label="링크 설명" unit="자" value={link} onChange={setLink} placeholder="예: 30" />
        <LimitRow
          label="해시태그"
          unit="개"
          value={hashtagCount}
          onChange={setHashtag}
          placeholder="예: 5"
        />
      </div>
      <FormActions
        hasExisting={hasExisting}
        canSave={canSave}
        onClear={onClear}
        onClose={onClose}
        onSubmit={submit}
      />
    </>
  );
}

function parseLimit(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function LimitRow({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex-1 font-semibold text-[13px] text-[var(--w-fg-strong)]">{label}</label>
      <div className="inline-flex items-center gap-1.5">
        <span className="font-medium text-[12px] text-[var(--w-fg-alternative)]">최대</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-20 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-lg px-2.5 py-1.5 font-semibold text-[13px] tabular-nums text-[var(--w-fg-strong)] text-right outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
        />
        <span className="font-medium text-[12px] text-[var(--w-fg-neutral)] w-3">{unit}</span>
      </div>
    </div>
  );
}

function CtaRestrictionsForm({
  initial,
  onSave,
  onClear,
  onClose,
  hasExisting,
}: {
  initial: CtaRestrictionsData;
  onSave: (data: CtaRestrictionsData) => void;
  onClear: () => void;
  onClose: () => void;
  hasExisting: boolean;
}) {
  const [blacklist, setBlacklist] = useState<string[]>(initial.blacklist);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string>(initial.note ?? "");

  const commit = () => {
    const incoming = draft
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !blacklist.includes(w));
    if (incoming.length === 0) return;
    setBlacklist((prev) => [...prev, ...incoming]);
    setDraft("");
  };

  const remove = (idx: number) => setBlacklist((prev) => prev.filter((_, i) => i !== idx));

  const canSave = blacklist.length > 0 || note.trim().length > 0;
  const submit = () =>
    onSave({ blacklist, ...(note.trim() ? { note: note.trim() } : {}) });

  return (
    <>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[12px] text-[var(--w-fg-alternative)] uppercase tracking-[0.06em]">
            금지 CTA
          </label>
          <div
            className="flex flex-wrap gap-1.5 min-h-[40px] border border-[var(--w-line-normal)] rounded-xl px-3 py-2 bg-[var(--w-bg)]"
          >
            {blacklist.length === 0 && (
              <span className="font-medium text-[12.5px] text-[var(--w-fg-alternative)] self-center">
                금지하고 싶은 CTA 문구를 추가
              </span>
            )}
            {blacklist.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium text-[12px] leading-none"
                style={{
                  background: "color-mix(in srgb, var(--w-accent-violet) 14%, transparent)",
                  color: "var(--w-accent-violet)",
                }}
              >
                {w}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="삭제"
                  className="border-none bg-transparent cursor-pointer p-0 inline-flex items-center text-current opacity-60 hover:opacity-100"
                >
                  <Icon name="x" size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              }
            }}
            onBlur={commit}
            placeholder="예: 지금 구매, 한정 할인"
            className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-2.5 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[12px] text-[var(--w-fg-alternative)] uppercase tracking-[0.06em]">
            메모 (선택)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 의료 광고는 '상담 예약'만 허용"
            className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-2.5 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
          />
        </div>
      </div>
      <FormActions
        hasExisting={hasExisting}
        canSave={canSave}
        onClear={onClear}
        onClose={onClose}
        onSubmit={submit}
      />
    </>
  );
}

function FreeTextForm({
  type,
  initial,
  onSave,
  onClear,
  onClose,
  hasExisting,
}: {
  type: FreeTextSopType;
  initial: FreeTextData;
  onSave: (data: FreeTextData) => void;
  onClear: () => void;
  onClose: () => void;
  hasExisting: boolean;
}) {
  const [text, setText] = useState<string>(initial.text);

  const canSave = text.trim().length > 0;
  const submit = () => onSave({ text: text.trim() });

  return (
    <>
      <div className="px-6 py-5 flex flex-col gap-2">
        <label className="font-semibold text-[12px] text-[var(--w-fg-alternative)] uppercase tracking-[0.06em]">
          룰
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={SOP_FREETEXT_PLACEHOLDER[type]}
          rows={8}
          autoFocus
          className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[13.5px] leading-[1.7] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)] resize-y"
        />
        <div className="font-medium text-[11.5px] text-[var(--w-fg-alternative)]">
          한 줄에 한 가지 룰씩 적으면 카드에서 bullet 으로 표시돼요.
        </div>
      </div>
      <FormActions
        hasExisting={hasExisting}
        canSave={canSave}
        onClear={onClear}
        onClose={onClose}
        onSubmit={submit}
      />
    </>
  );
}
