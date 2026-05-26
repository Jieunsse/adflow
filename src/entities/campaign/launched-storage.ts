"use client";

// PRD-ab-testing.md §10.1 — adflow:launched:{campaignId} 영속화.
// /api/campaign 응답 받자마자 저장 → PerformanceStep + /campaigns/[id] 두 화면이 campaignId 만으로 결과 카드 표시.

import type { LaunchedCampaign } from "./model";
import { syncUpsert } from "@shared/lib/supabase-sync";

const key = (campaignId: string) => `adflow:launched:${campaignId}`;

export function saveLaunchedCampaign(value: LaunchedCampaign): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(value.campaignId), JSON.stringify(value));
  } catch {
    // quota / private mode — silently swallow. 결과 카드는 in-memory state 로 폴백.
  }
  syncUpsert("campaign_launches", { campaign_id: value.campaignId, data: value });
}

export function loadLaunchedCampaign(campaignId: string): LaunchedCampaign | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(campaignId));
    if (!raw) return null;
    return JSON.parse(raw) as LaunchedCampaign;
  } catch {
    return null;
  }
}
