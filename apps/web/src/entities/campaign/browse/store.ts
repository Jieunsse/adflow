"use client";

// Browse Mode 시연 캠페인 localStorage CRUD. 단일 키에 배열로 저장 (auto-relaunch.ts 패턴).
// 실제 /campaigns 데이터(MOCK_CAMPAIGN_SUMMARIES)와 분리 — 목록 페이지가 browseMode 분기로 merge.

import type { BrowseCampaign } from "./types";

const KEY = "adflow:browse:campaigns";
const VERSION_KEY = "adflow:browse:seed-version";
// 시드 스키마(데모 브랜드 등)가 바뀌면 이 값을 올린다 — 옛 localStorage 잔재가 한 번 비워진다.
const SEED_VERSION = "2026-05-30-greenroutine";
export const BROWSE_CHANGE_EVENT = "adflow:browse:change";

function ensureVersion(): void {
  try {
    if (localStorage.getItem(VERSION_KEY) === SEED_VERSION) return;
    localStorage.removeItem(KEY);
    localStorage.setItem(VERSION_KEY, SEED_VERSION);
  } catch {}
}

function read(): BrowseCampaign[] {
  if (typeof window === "undefined") return [];
  ensureVersion();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BrowseCampaign[]) : [];
  } catch {
    return [];
  }
}

function write(list: BrowseCampaign[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 용량 초과(예: 이전에 저장된 풀사이즈 이미지) — 오래된 캠페인부터 버리고 재시도해 최신 항목은 반드시 남긴다.
    const newestFirst = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (let keep = newestFirst.length - 1; keep >= 1; keep--) {
      try {
        localStorage.setItem(KEY, JSON.stringify(newestFirst.slice(0, keep)));
        break;
      } catch {}
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BROWSE_CHANGE_EVENT));
  }
}

export function listBrowse(): BrowseCampaign[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBrowse(id: string): BrowseCampaign | null {
  return read().find((c) => c.id === id) ?? null;
}

export function upsertBrowse(camp: BrowseCampaign): void {
  const list = read();
  const idx = list.findIndex((c) => c.id === camp.id);
  if (idx >= 0) list[idx] = camp;
  else list.push(camp);
  write(list);
}

export function deleteBrowse(id: string): void {
  write(read().filter((c) => c.id !== id));
}

export function resetBrowse(): void {
  write([]);
}
