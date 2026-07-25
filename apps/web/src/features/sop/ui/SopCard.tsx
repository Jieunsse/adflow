"use client";

import Icon from "@shared/ui/Icon";
import {
  isSectionFilled,
  type SopItemType,
  type SopSection,
} from "@features/sop/model/useSopStorage";
import { SOP_SECTION_LABEL, SOP_SECTION_DESCRIPTION } from "@features/sop/model/section-labels";
import { SECTION_ACCENT, SECTION_ICON } from "./section-style";

type IconName = Parameters<typeof Icon>[0]["name"];

interface SopCardProps {
  type: SopItemType;
  section?: SopSection;
  canEdit: boolean;
  onEdit: () => void;
}

export default function SopCard({ type, section, canEdit, onEdit }: SopCardProps) {
  const accent = SECTION_ACCENT[type];
  const iconName = SECTION_ICON[type] as IconName;
  const filled = !!section && isSectionFilled(section);

  return (
    <div
      className="group relative border rounded-2xl px-4 py-4 flex flex-col gap-3 min-h-[160px] transition-colors"
      style={{
        background: filled
          ? `color-mix(in srgb, ${accent} 5%, var(--w-bg-elevated))`
          : "var(--w-bg-elevated)",
        borderColor: filled
          ? `color-mix(in srgb, ${accent} 22%, transparent)`
          : "var(--w-line-normal)",
        borderStyle: filled ? "solid" : "dashed",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: filled
              ? `color-mix(in srgb, ${accent} 16%, transparent)`
              : "var(--w-bg-alternative)",
            color: filled ? accent : "var(--w-fg-alternative)",
          }}
        >
          <Icon name={iconName} size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] leading-[1.3] text-[var(--w-fg-strong)] tracking-[-0.006em] truncate">
            {SOP_SECTION_LABEL[type]}
          </div>
          <div className="font-medium text-[11px] leading-[1.35] text-[var(--w-fg-alternative)] truncate mt-0.5">
            {SOP_SECTION_DESCRIPTION[type]}
          </div>
        </div>
        {canEdit && filled && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="편집"
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg border-none bg-transparent cursor-pointer text-[var(--w-fg-alternative)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--w-bg-alternative)] hover:text-[var(--w-fg-strong)] transition-[opacity,background-color,color]"
          >
            <Icon name="edit" size={13} />
          </button>
        )}
      </div>

      {filled ? (
        <div className="flex-1">
          {section.source === "ai-classified" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--w-accent-violet-soft)] font-semibold text-[10px] leading-none uppercase tracking-[0.04em] text-[var(--w-accent-violet)] mb-2">
              AI 분류
            </span>
          )}
          <CardBody section={section} accent={accent} />
        </div>
      ) : (
        <button
          type="button"
          onClick={canEdit ? onEdit : undefined}
          disabled={!canEdit}
          className="flex-1 flex flex-col items-start justify-center gap-1.5 -mx-1 px-1 py-1 border-none bg-transparent text-left rounded-lg transition-colors disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-[var(--w-bg-alternative)]/60"
        >
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)]">
            {canEdit
              ? "아직 정의된 룰이 없어요"
              : "팀장이 정의하면 여기에 표시돼요"}
          </div>
          {canEdit && (
            <div className="inline-flex items-center gap-1 font-semibold text-[12px] leading-none text-[var(--w-primary-press)]">
              <Icon name="plus" size={12} /> 추가
            </div>
          )}
        </button>
      )}
    </div>
  );
}

function CardBody({ section, accent }: { section: SopSection; accent: string }) {
  switch (section.type) {
    case "prohibited_words":
      return <ChipList items={section.data.words} accent={accent} />;
    case "required_phrases":
      return <ChipList items={section.data.phrases} accent={accent} />;
    case "required_hashtags":
      return <ChipList items={section.data.hashtags} accent={accent} />;
    case "length_limits":
      return <LengthRows data={section.data} />;
    case "cta_restrictions":
      return (
        <div className="flex flex-col gap-2">
          <ChipList items={section.data.blacklist} accent={accent} />
          {section.data.note?.trim() && (
            <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] pt-1.5 border-t border-[var(--w-line-normal)]">
              <span className="font-semibold text-[var(--w-fg-alternative)]">메모 </span>
              {section.data.note}
            </div>
          )}
        </div>
      );
    default:
      return <BulletList text={section.data.text} />;
  }
}

function ChipList({ items, accent }: { items: string[]; accent: string }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((w, i) => (
        <span
          key={i}
          className="inline-flex items-center px-2 py-1 rounded-md font-medium text-[12px] leading-none"
          style={{
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            color: accent,
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

function LengthRows({
  data,
}: {
  data: { headline?: number; body?: number; link?: number; hashtagCount?: number };
}) {
  const rows: { label: string; value: string }[] = [];
  if (data.headline != null) rows.push({ label: "헤드라인", value: `≤ ${data.headline}자` });
  if (data.body != null) rows.push({ label: "본문", value: `≤ ${data.body}자` });
  if (data.link != null) rows.push({ label: "링크 설명", value: `≤ ${data.link}자` });
  if (data.hashtagCount != null)
    rows.push({ label: "해시태그", value: `≤ ${data.hashtagCount}개` });
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between font-medium text-[13px] leading-[1.6] text-[var(--w-fg-strong)]"
        >
          <span className="text-[var(--w-fg-neutral)]">{r.label}</span>
          <span className="tabular-nums font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function BulletList({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return (
    <ul className="flex flex-col gap-1 m-0 pl-3.5">
      {lines.map((l, i) => (
        <li
          key={i}
          className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)]"
          style={{ listStyleType: "disc" }}
        >
          {l}
        </li>
      ))}
    </ul>
  );
}
