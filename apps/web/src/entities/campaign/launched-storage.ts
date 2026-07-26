"use client";

// PRD-ab-testing.md §10.1 — 게재 영수증. 단계 3 에서 Tier 1 으로 승격.
// 이전: `adflow:launched:{campaignId}` 키 + syncUpsert 미러(에러 삼킴).

import { createSyncedStore, scanLegacyKeys } from "@shared/lib/store";
import type { LaunchedCampaign } from "./model";

const LEGACY_PREFIX = "adflow:launched:";
const LAUNCHES_KEY = "adflow:launches:v1"; // zustand persist 봉투

/** 인덱스가 없어 접두사 스캔으로 건져 올린다. */
export function absorbLegacyLaunches(): LaunchedCampaign[] {
  return scanLegacyKeys<LaunchedCampaign>(LEGACY_PREFIX).filter((l) => !!l?.campaignId);
}

export const campaignLaunches = createSyncedStore<LaunchedCampaign>({
  name: LAUNCHES_KEY,
  endpoint: "/api/stores/campaign-launches",
  idOf: (l) => l.campaignId,
  migrate: absorbLegacyLaunches,
});

if (typeof window !== "undefined") campaignLaunches.rehydrate();

/** 게재 직후 저장. 훅 밖(핸들러)에서 호출되므로 동기 시그니처를 유지한다. */
export function saveLaunchedCampaign(value: LaunchedCampaign): void {
  campaignLaunches.useStore.getState().upsert(value);
}

/** 동기 포인트 리더. campaigns/[id] 가 useState 초기화자에서 호출한다. */
export function loadLaunchedCampaign(campaignId: string): LaunchedCampaign | null {
  return campaignLaunches.snapshot().find((l) => l.campaignId === campaignId) ?? null;
}
