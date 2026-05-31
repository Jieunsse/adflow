"use client";

import { useCallback, useEffect, useState } from "react";
import { syncUpsert } from "@shared/lib/supabase-sync";
import { seedDemoIfEmpty } from "@features/brand-profile/model/seed-demo";
import type { SopSection } from "@features/sop/model/useSopStorage";

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
}

export interface BrandProfileEntry extends BrandProfile {
  id: string;
  name: string;
  isDefault?: boolean;
  policy?: SopSection[];
}

const PROFILES_KEY = "adflow:brand-profiles";
const ACTIVE_ID_KEY = "adflow:brand-profile:active-id";
const LEGACY_KEY = "adflow:brand-profile";

function migrateIfNeeded(): void {
  if (localStorage.getItem(PROFILES_KEY)) return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  try {
    const bp = JSON.parse(legacy) as BrandProfile;
    const entry: BrandProfileEntry = { id: "default", name: "기본 프로필", isDefault: true, ...bp };
    localStorage.setItem(PROFILES_KEY, JSON.stringify([entry]));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export function readProfiles(): BrandProfileEntry[] {
  if (typeof window === "undefined") return [];
  migrateIfNeeded();
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "[]") as BrandProfileEntry[];
  } catch {
    return [];
  }
}

function persistProfiles(profiles: BrandProfileEntry[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {}
}

function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

function setActiveIdInStorage(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  } catch {}
}

export function readBrandProfile(): BrandProfile {
  const profiles = readProfiles();
  if (!profiles.length) return {};
  const activeId = getActiveId();
  const entry =
    profiles.find((p) => p.id === activeId) ??
    profiles.find((p) => p.isDefault) ??
    profiles[0];
  const { id: _id, name: _name, isDefault: _isDefault, ...bp } = entry;
  return bp;
}

export function readActiveBrandProfileEntry(): BrandProfileEntry | null {
  const profiles = readProfiles();
  if (!profiles.length) return null;
  const activeId = getActiveId();
  return (
    profiles.find((p) => p.id === activeId) ??
    profiles.find((p) => p.isDefault) ??
    profiles[0]
  );
}

export function appendToBrandProfile(
  field: "brandVoice" | "imageGuide",
  content: string
): void {
  const profiles = readProfiles();
  if (!profiles.length) return;
  const activeId = getActiveId();
  let idx = profiles.findIndex((p) => p.id === activeId);
  if (idx < 0) idx = profiles.findIndex((p) => p.isDefault);
  if (idx < 0) idx = 0;
  const entry = { ...profiles[idx] };
  const existing = ((entry[field] ?? "") as string).trim();
  entry[field] = existing ? `${existing}\n${content.trim()}` : content.trim();
  profiles[idx] = entry;
  persistProfiles(profiles);
}

// For STEP 01 — reads active profile, exposes list for selector.
// seedDemo: 둘러보기 모드 진입 시 비어있으면 데모 브랜드 프로필을 자동 주입 (ADR-033).
export function useBrandProfileStorage(seedDemo = false) {
  const [profiles, setProfiles] = useState<BrandProfileEntry[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    if (seedDemo) seedDemoIfEmpty();
    setProfiles(readProfiles());
    setActiveIdState(getActiveId());
  }, [seedDemo]);

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
  const [profiles, setProfiles] = useState<BrandProfileEntry[]>([]);

  useEffect(() => {
    setProfiles(readProfiles());
  }, []);

  const saveProfile = useCallback((entry: BrandProfileEntry): void => {
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === entry.id);
      const next = idx >= 0 ? prev.map((p, i) => (i === idx ? entry : p)) : [...prev, entry];
      persistProfiles(next);
      syncUpsert("brand_profile", entry as unknown as Record<string, unknown>);
      return next;
    });
  }, []);

  const deleteProfile = useCallback((id: string): void => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistProfiles(next);
      return next;
    });
  }, []);

  const setDefault = useCallback((id: string): void => {
    setProfiles((prev) => {
      const next = prev.map((p) => ({ ...p, isDefault: p.id === id }));
      persistProfiles(next);
      return next;
    });
  }, []);

  return { profiles, saveProfile, deleteProfile, setDefault };
}
