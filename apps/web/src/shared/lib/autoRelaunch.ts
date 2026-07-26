"use client";

// useAutoRelaunch — Auto Relaunch 상태(ADR-012). 단계 3 에서 Tier 1 으로 승격.
// 이전: `auto-relaunch:<campaignId>` 키 + syncUpsert 미러(에러 삼킴).

import { useCallback } from "react";
import { createSyncedStore, scanLegacyKeys } from "./store";

export type AutoRelaunchEntry = {
  campaignId: string;
  enabled: boolean;
  cycleCount: number;
  parentCampaignId?: string;
  createdAt: string;
  updatedAt: string;
};

const LEGACY_PREFIX = "auto-relaunch:";
const STATES_KEY = "adflow:auto-relaunch:v1"; // zustand persist 봉투

/** 인덱스가 없어 접두사 스캔으로 건져 올린다. */
export function absorbLegacyAutoRelaunch(): AutoRelaunchEntry[] {
  return scanLegacyKeys<AutoRelaunchEntry>(LEGACY_PREFIX).filter((e) => !!e?.campaignId);
}

export const autoRelaunchStates = createSyncedStore<AutoRelaunchEntry>({
  name: STATES_KEY,
  endpoint: "/api/stores/auto-relaunch",
  idOf: (e) => e.campaignId,
  migrate: absorbLegacyAutoRelaunch,
});

const { useStore } = autoRelaunchStates;

if (typeof window !== "undefined") autoRelaunchStates.rehydrate();

/** 동기 포인트 리더. presenter-fast-forward·campaigns/[id] 가 렌더 중 호출한다. */
export function readAutoRelaunch(campaignId: string): AutoRelaunchEntry | null {
  return autoRelaunchStates.snapshot().find((e) => e.campaignId === campaignId) ?? null;
}

export function useAutoRelaunch() {
  autoRelaunchStates.useSync();
  const upsert = useStore((s) => s.upsert);

  const get = useCallback((campaignId: string) => readAutoRelaunch(campaignId), []);

  const setEnabled = useCallback(
    (campaignId: string, enabled: boolean): void => {
      const now = new Date().toISOString();
      const existing = readAutoRelaunch(campaignId);
      upsert(
        existing
          ? { ...existing, enabled, updatedAt: now }
          : { campaignId, enabled, cycleCount: 1, createdAt: now, updatedAt: now },
      );
    },
    [upsert],
  );

  const inheritFromParent = useCallback(
    (parentCampaignId: string, newCampaignId: string, enabledOverride?: boolean): void => {
      const parent = readAutoRelaunch(parentCampaignId);
      const now = new Date().toISOString();
      upsert({
        campaignId: newCampaignId,
        enabled: enabledOverride !== undefined ? enabledOverride : (parent?.enabled ?? true),
        cycleCount: (parent?.cycleCount ?? 1) + 1,
        parentCampaignId,
        createdAt: now,
        updatedAt: now,
      });
    },
    [upsert],
  );

  const getCycleCount = useCallback(
    (campaignId: string): number => readAutoRelaunch(campaignId)?.cycleCount ?? 1,
    [],
  );

  return { get, setEnabled, inheritFromParent, getCycleCount };
}
