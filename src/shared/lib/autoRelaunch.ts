"use client";

// useAutoRelaunch — localStorage CRUD for Auto Relaunch feature (ADR-012).
// 키: `auto-relaunch:<campaignId>`, 패턴: useKpiTargets / useLibrary 와 동일.

import { useCallback } from "react";

export type AutoRelaunchEntry = {
  campaignId: string;
  enabled: boolean;
  cycleCount: number;
  parentCampaignId?: string;
  createdAt: string;
  updatedAt: string;
};

const KEY = (id: string) => `auto-relaunch:${id}`;

function readEntry(campaignId: string): AutoRelaunchEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY(campaignId));
    return raw ? (JSON.parse(raw) as AutoRelaunchEntry) : null;
  } catch {
    return null;
  }
}

function writeEntry(entry: AutoRelaunchEntry): void {
  try {
    localStorage.setItem(KEY(entry.campaignId), JSON.stringify(entry));
  } catch {}
}

export function useAutoRelaunch() {
  const get = useCallback((campaignId: string): AutoRelaunchEntry | null => {
    return readEntry(campaignId);
  }, []);

  const setEnabled = useCallback((campaignId: string, enabled: boolean): void => {
    const now = new Date().toISOString();
    const existing = readEntry(campaignId);
    if (existing) {
      writeEntry({ ...existing, enabled, updatedAt: now });
    } else {
      writeEntry({
        campaignId,
        enabled,
        cycleCount: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }, []);

  const inheritFromParent = useCallback((
    parentCampaignId: string,
    newCampaignId: string,
    enabledOverride?: boolean,
  ): void => {
    const parent = readEntry(parentCampaignId);
    const now = new Date().toISOString();
    writeEntry({
      campaignId: newCampaignId,
      enabled: enabledOverride !== undefined ? enabledOverride : (parent?.enabled ?? true),
      cycleCount: (parent?.cycleCount ?? 1) + 1,
      parentCampaignId,
      createdAt: now,
      updatedAt: now,
    });
  }, []);

  const getCycleCount = useCallback((campaignId: string): number => {
    return readEntry(campaignId)?.cycleCount ?? 1;
  }, []);

  return { get, setEnabled, inheritFromParent, getCycleCount };
}
