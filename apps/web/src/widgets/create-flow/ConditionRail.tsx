"use client";

// 시안 1c·2a 좌측의 232px 레일. 3안이 "같은 조건에서" 나왔다는 걸 붙잡아 주는 자리.

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { useCreativeDraft } from "@entities/creative/model";
import { OBJECTIVES_PHASE1, TONES } from "@entities/creative/options";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { usePersonasForProfile } from "@features/brand-profile/model/usePersonasStorage";
import { PanelCard } from "./parts";
import { useBrandHandle } from "./useBrandHandle";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-[var(--w-line-alternative)]">
      <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">{label}</div>
      <div className="font-semibold text-[13px] leading-[1.5] text-[var(--w-fg-strong)]">{value}</div>
    </div>
  );
}

export default function ConditionRail({
  personaId,
  onEdit,
}: {
  personaId: string | null;
  onEdit: () => void;
}) {
  const creative = useCreativeDraft();
  const { data: session } = useSession();
  const { profile: bp, activeId } = useBrandProfileStorage(!!session?.browseMode);
  const { personas } = usePersonasForProfile(activeId ?? "");
  const handle = useBrandHandle();

  const outcome = creative.state.outcome;
  const outcomeLabel = OBJECTIVES_PHASE1.find((o) => o.id === outcome)?.label ?? "아직 안 골랐어요";
  const persona = personas.find((pe) => pe.id === personaId);
  const toneId = bp.tone ?? creative.state.tone;
  const toneLabel = TONES.find((t) => t.id === toneId)?.label ?? toneId ?? "기본";
  const proofPoints = (bp.proofPoints ?? []).filter((t) => t.trim());

  return (
    <PanelCard className="w-[232px] shrink-0 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--w-line-alternative)] font-bold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">
        공통 조건
      </div>
      <Row label="브랜드" value={`@${handle}`} />
      <Row label="광고 목표" value={outcomeLabel} />
      <Row label="타겟" value={persona?.name ?? "지정 안 함"} />
      <Row label="광고 느낌" value={toneLabel} />
      {proofPoints.length > 0 && (
        <div className="px-4 py-3">
          <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] mb-2">
            근거 자료 {proofPoints.length}건
          </div>
          <div className="flex flex-col gap-1.5 items-start">
            {proofPoints.slice(0, 3).map((t) => (
              <Chip key={t} variant="success" size="sm">{t}</Chip>
            ))}
          </div>
        </div>
      )}
      <div className="px-4 py-3 border-t border-[var(--w-line-alternative)]">
        <Button variant="secondary" size="sm" block type="button" onClick={onEdit}>
          조건 수정
        </Button>
      </div>
    </PanelCard>
  );
}
