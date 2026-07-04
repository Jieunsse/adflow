"use client";

// Brand Profile — 도메인 형태(타입)와 읽기/쓰기 표면. ADR-046: Synced Store(Tier 1)로 이관 —
// Supabase=source-of-truth(로그인 시 하이드레이션), localStorage(persist)=오프라인 캐시, 게스트=로컬만.
// store·동기·영속은 brandProfileStore 가 담당(런타임 순환 회피). 동기 리더는 워밍된 getState 스냅샷을 읽는다.
// (이전: useScopedStorage + 단방향 syncUpsert 미러 — 기기 바뀌면 소실)

import { useCallback, useEffect, useState } from "react";
import { seedDemoIfEmpty } from "@features/brand-profile/model/seed-demo";
import type { SopSection } from "@features/sop/model/useSopStorage";
import {
  brandProfiles,
  useSyncBrandProfiles,
  profilesSnapshot,
  upsertProfile,
  removeProfile,
  setDefaultProfile,
  getActiveId,
  setActiveIdInStorage,
} from "./brandProfileStore";

export type CopyReference = {
  id: string;
  text: string;
  source: "ig" | "manual";
  createdAt: string;
};

export interface BrandProfile {
  brandDescription?: string;
  tone?: string;
  brandVoice?: string;
  customerVoiceSummary?: string;
  imageGuide?: string;
  copyReferences?: CopyReference[];
  /** 근거 자료 (ADR-031) — 카피에 성과·사회적 증거 수치를 넣을 수 있는 유일한 출처. */
  proofPoints?: string[];
  /** 브랜드 전역 단일 평균 마진율 (ADR-060) — 0~1. 공헌이익·BEP ROAS 산술의 유일한 입력. */
  marginRate?: number;
}

export interface BrandProfileEntry extends BrandProfile {
  id: string;
  name: string;
  isDefault?: boolean;
  policy?: SopSection[];
}

function activeOf(profiles: BrandProfileEntry[]): BrandProfileEntry | undefined {
  const activeId = getActiveId();
  return (
    profiles.find((p) => p.id === activeId) ??
    profiles.find((p) => p.isDefault) ??
    profiles[0]
  );
}

export function readProfiles(): BrandProfileEntry[] {
  return profilesSnapshot();
}

export function readBrandProfile(): BrandProfile {
  const entry = activeOf(profilesSnapshot());
  if (!entry) return {};
  const { id: _id, name: _name, isDefault: _isDefault, ...bp } = entry;
  return bp;
}

export function readActiveBrandProfileEntry(): BrandProfileEntry | null {
  return activeOf(profilesSnapshot()) ?? null;
}

export function appendToBrandProfile(
  field: "brandVoice" | "imageGuide",
  content: string
): void {
  const entry = activeOf(profilesSnapshot());
  if (!entry) return;
  const existing = ((entry[field] ?? "") as string).trim();
  upsertProfile({
    ...entry,
    [field]: existing ? `${existing}\n${content.trim()}` : content.trim(),
  });
}

// SSR 가드: status 가 idle(아직 mount 전)이면 빈 배열 — 서버 HTML 과 첫 렌더 일치.
// mount 후 useSyncBrandProfiles 의 hydrate 가 status 를 올리면 워밍된 items 노출.
function useProfilesReactive(): BrandProfileEntry[] {
  const items = brandProfiles.useStore((s) => s.items);
  const ready = brandProfiles.useStore((s) => s.status !== "idle");
  return ready ? items : [];
}

// For STEP 01 — reads active profile, exposes list for selector.
// seedDemo: 둘러보기 모드 진입 시 비어있으면 데모 브랜드 프로필을 자동 주입 (ADR-033).
export function useBrandProfileStorage(seedDemo = false) {
  useSyncBrandProfiles();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    if (seedDemo) seedDemoIfEmpty();
    setActiveIdState(getActiveId());
  }, [seedDemo]);

  const profiles = useProfilesReactive();

  const activeEntry =
    profiles.find((p) => p.id === activeId) ??
    profiles.find((p) => p.isDefault) ??
    profiles[0] ??
    null;

  const profile: BrandProfile = activeEntry ?? {};

  const setActiveId = useCallback((id: string) => {
    setActiveIdInStorage(id);
    setActiveIdState(id);
  }, []);

  const isConfigured = !!(profile.brandVoice || profile.tone);

  return { profile, profiles, activeId: activeEntry?.id ?? null, setActiveId, isConfigured };
}

// For brand-profile list page — full CRUD
export function useBrandProfilesStorage() {
  useSyncBrandProfiles();
  const profiles = useProfilesReactive();

  const saveProfile = useCallback((entry: BrandProfileEntry): void => {
    upsertProfile(entry);
  }, []);

  const deleteProfile = useCallback((id: string): void => {
    removeProfile(id);
  }, []);

  const setDefault = useCallback((id: string): void => {
    setDefaultProfile(id);
  }, []);

  return { profiles, saveProfile, deleteProfile, setDefault };
}
