"use client";

import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import type { PersonaEntry } from "../model/usePersonasStorage";

const GENDER_LABEL: Record<number, string> = { 1: "남", 2: "여" };

const PALETTE: string[] = [
  "linear-gradient(160deg, #FFE8DC 0%, #FFD0BE 100%)",
  "linear-gradient(160deg, #C8DCFA 0%, #A8C4F0 100%)",
  "linear-gradient(160deg, #D8EEE8 0%, #B8DECE 100%)",
  "linear-gradient(160deg, #E8DCFA 0%, #D0BEF0 100%)",
  "linear-gradient(160deg, #FBE4C8 0%, #F4CDA0 100%)",
  "linear-gradient(160deg, #FAD0DA 0%, #F0AEC0 100%)",
];

interface Props {
  persona: PersonaEntry;
  index?: number;
  canEdit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PersonaCard({ persona, index = 0, canEdit = true, onEdit, onDelete }: Props) {
  const bg = PALETTE[index % PALETTE.length];

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
    <Card
      className={`p-0 overflow-hidden flex flex-col transition-[border-color] duration-[120ms] ease-in-out ${canEdit ? "cursor-pointer" : "cursor-default"}`}
      onClick={canEdit ? onEdit : undefined}
    >
      <div
        className="flex items-end px-4 py-5 min-h-[88px] overflow-hidden"
        style={{ background: bg }}
      >
        <div className="w-full font-bold text-[16px] leading-[1.35] tracking-[-0.014em] [font-family:var(--w-font-display)] [text-shadow:0_1px_4px_rgba(0,0,0,0.25)] text-white">
          {persona.name}
        </div>
      </div>
      <div className="flex flex-col gap-[10px] p-[14px] flex-1">
        <div className="flex flex-wrap gap-[6px]">
          {ageLabel && <Chip variant="neutral">{ageLabel}</Chip>}
          <Chip variant="neutral">{genderLabel}</Chip>
          {(persona.interests ?? []).slice(0, 3).map((i) => (
            <Chip key={i} variant="neutral">{i}</Chip>
          ))}
        </div>
        {persona.customerDescription && (
          <div className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)] line-clamp-2">
            {persona.customerDescription}
          </div>
        )}
        {canEdit && (
          <div className="flex items-center justify-end mt-auto pt-[10px] border-t border-[var(--w-line-alternative)]">
            <Button variant="ghost" size="sm" className="text-[var(--w-fg-alternative)]" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Icon name="x" size={14} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
