"use client";

import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import type { PersonaEntry } from "../model/usePersonasStorage";

const GENDER_LABEL: Record<number, string> = { 1: "남", 2: "여" };

interface Props {
  persona: PersonaEntry;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PersonaCard({ persona, onEdit, onDelete }: Props) {
  const ageLabel =
    persona.ageMin != null && persona.ageMax != null
      ? `${persona.ageMin}–${persona.ageMax}세`
      : persona.ageMin != null
        ? `${persona.ageMin}세 이상`
        : persona.ageMax != null
          ? `${persona.ageMax}세 이하`
          : null;

  const genderLabel =
    !persona.genders || persona.genders.length === 0
      ? "전체"
      : persona.genders.map((g) => GENDER_LABEL[g] ?? g).join("·");

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 px-4 py-3.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] cursor-pointer transition-[border-color,box-shadow] duration-[120ms]",
        "hover:border-[var(--w-primary-normal)] hover:shadow-[0_0_0_3px_rgba(0,102,255,0.10)]",
      )}
      onClick={onEdit}
    >
      <span className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)] pr-6">
        {persona.name}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {ageLabel && (
          <Badge>{ageLabel}</Badge>
        )}
        <Badge>{genderLabel}</Badge>
        {(persona.interests ?? []).slice(0, 2).map((i) => (
          <Badge key={i}>{i}</Badge>
        ))}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-md text-[var(--w-fg-neutral)] opacity-0 group-hover:opacity-100 hover:bg-[var(--w-bg-neutral)] transition-opacity"
        aria-label="삭제"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--w-bg-neutral)] font-medium text-[12px] leading-none text-[var(--w-fg-neutral)]">
      {children}
    </span>
  );
}
