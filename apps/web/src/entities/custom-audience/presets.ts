// ADR-062 Decision 1/2/3 — 프리셋 3종 고정, 자유 규칙 빌더 없음. 보존 기간은 유저 노출 없는 상수.
// 결정적 이름 = 멱등 생성의 유일한 근거(list-before-create, 별도 저장소 불요).

import type { AudiencePresetId } from "./types";

export interface AudiencePreset {
  id: AudiencePresetId;
  label: string;
  retentionDays: number;
  requiresPixel: boolean;
}

export const AUDIENCE_PRESETS: readonly AudiencePreset[] = [
  { id: "ig_engagers", label: "우리 인스타에 반응한 사람", retentionDays: 365, requiresPixel: false },
  { id: "website_visitors", label: "우리 사이트에 다녀간 사람", retentionDays: 30, requiresPixel: true },
  { id: "purchasers", label: "우리 제품을 구매한 사람", retentionDays: 180, requiresPixel: true },
];

export function presetOf(id: AudiencePresetId): AudiencePreset {
  const preset = AUDIENCE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`알 수 없는 맞춤 타겟 프리셋이에요: ${id}`);
  return preset;
}

// 멱등 생성의 유일한 근거 — Ads Manager 에서 유저가 이름을 바꾸지 않는 한 항상 동일.
export function presetAudienceName(preset: AudiencePreset): string {
  return `AdFlow · ${preset.label} · ${preset.retentionDays}일`;
}
