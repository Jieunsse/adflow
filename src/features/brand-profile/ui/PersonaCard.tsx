"use client";

import Image from "next/image";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import type { PersonaEntry } from "../model/usePersonasStorage";

const GENDER_LABEL: Record<number, string> = { 1: "남", 2: "여" };

const GENDER_BG: Record<"male" | "female" | "all", string> = {
  male: "linear-gradient(160deg, #C8DCFA 0%, #A8C4F0 100%)",
  female: "linear-gradient(160deg, #FFE8DC 0%, #FFD0BE 100%)",
  all: "linear-gradient(160deg, #D8EEE8 0%, #B8DECE 100%)",
};

interface Props {
  persona: PersonaEntry;
  canEdit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PersonaCard({ persona, canEdit = true, onEdit, onDelete }: Props) {
  const isMale = persona.genders?.length === 1 && persona.genders[0] === 1;
  const isFemale = persona.genders?.length === 1 && persona.genders[0] === 2;
  const genderType = isMale ? "male" : isFemale ? "female" : "all";

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
        className="relative aspect-[16/10] flex flex-col items-center justify-center overflow-hidden"
        style={{ background: GENDER_BG[genderType] }}
      >
        <div className="flex-1 flex items-end justify-center gap-4 w-full">
          {genderType === "male" && (
            <Image src="/personas/avatar-male.png" alt="남성 페르소나" width={160} height={160} className="object-contain object-bottom" />
          )}
          {genderType === "female" && (
            <Image src="/personas/avatar-female.png" alt="여성 페르소나" width={160} height={160} className="object-contain object-bottom" />
          )}
          {genderType === "all" && (
            <>
              <Image src="/personas/avatar-male.png" alt="남성 페르소나" width={120} height={120} className="object-contain object-bottom" />
              <Image src="/personas/avatar-female.png" alt="여성 페르소나" width={120} height={120} className="object-contain object-bottom" />
            </>
          )}
        </div>
        <div className="w-full px-4 pb-3 font-bold text-[16px] leading-[1.35] tracking-[-0.014em] [font-family:var(--w-font-display)] [text-shadow:0_2px_8px_rgba(0,0,0,0.28)] text-white">
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
