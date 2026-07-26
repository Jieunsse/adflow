"use client";

import { useCallback } from "react";
import { createSyncedStore } from "@shared/lib/store";

export type SopItemType =
  | "prohibited_words"
  | "required_phrases"
  | "required_hashtags"
  | "length_limits"
  | "cta_restrictions"
  | "image_restrictions"
  | "industry_regulations"
  | "competitor_policy"
  | "pricing_rules"
  | "audience_restrictions"
  | "platform_rules";

export type SopSectionSource = "user" | "ai-classified" | "ai-generated";

export interface ProhibitedWordsData {
  words: string[];
}

export interface LengthLimitsData {
  headline?: number;
  body?: number;
  link?: number;
  hashtagCount?: number;
}

export interface CtaRestrictionsData {
  blacklist: string[];
  note?: string;
}

export interface RequiredPhrasesData {
  phrases: string[];
}

export interface RequiredHashtagsData {
  hashtags: string[];
}

export interface FreeTextData {
  text: string;
}

export type FreeTextSopType =
  | "industry_regulations"
  | "competitor_policy"
  | "pricing_rules"
  | "audience_restrictions"
  | "platform_rules"
  | "image_restrictions";

export type SopSection =
  | { type: "prohibited_words"; data: ProhibitedWordsData; source?: SopSectionSource }
  | { type: "required_phrases"; data: RequiredPhrasesData; source?: SopSectionSource }
  | { type: "required_hashtags"; data: RequiredHashtagsData; source?: SopSectionSource }
  | { type: "length_limits"; data: LengthLimitsData; source?: SopSectionSource }
  | { type: "cta_restrictions"; data: CtaRestrictionsData; source?: SopSectionSource }
  | { type: FreeTextSopType; data: FreeTextData; source?: SopSectionSource };

export interface Sop {
  id: string;
  name: string;
  description?: string;
  sections: SopSection[];
  createdAt: string;
  updatedAt: string;
}

export function isSectionFilled(s: SopSection): boolean {
  switch (s.type) {
    case "prohibited_words":
      return s.data.words.length > 0;
    case "required_phrases":
      return s.data.phrases.length > 0;
    case "required_hashtags":
      return s.data.hashtags.length > 0;
    case "length_limits":
      return (
        s.data.headline != null ||
        s.data.body != null ||
        s.data.link != null ||
        s.data.hashtagCount != null
      );
    case "cta_restrictions":
      return s.data.blacklist.length > 0 || !!s.data.note?.trim();
    default:
      return s.data.text.trim().length > 0;
  }
}

export function sectionPreviewText(s: SopSection): string {
  switch (s.type) {
    case "prohibited_words":
      return s.data.words.slice(0, 4).join(", ");
    case "required_phrases":
      return s.data.phrases.slice(0, 3).join(", ");
    case "required_hashtags":
      return s.data.hashtags.slice(0, 4).join(" ");
    case "length_limits": {
      const parts: string[] = [];
      if (s.data.headline != null) parts.push(`헤드라인 ≤ ${s.data.headline}자`);
      if (s.data.body != null) parts.push(`본문 ≤ ${s.data.body}자`);
      if (s.data.link != null) parts.push(`링크 ≤ ${s.data.link}자`);
      if (s.data.hashtagCount != null) parts.push(`해시태그 ≤ ${s.data.hashtagCount}개`);
      return parts.slice(0, 3).join(" · ");
    }
    case "cta_restrictions":
      return s.data.blacklist.slice(0, 4).join(", ");
    default:
      return s.data.text.split("\n").find((l) => l.trim().length > 0) ?? "";
  }
}

const LEGACY_INDEX_KEY = "adflow:sop-index";
const legacyItemKey = (id: string) => `adflow:sop:${id}`;
const VERSION_KEY = "adflow:sop:version";
const CURRENT_VERSION = "2";

const SOPS_KEY = "adflow:sops:v1"; // zustand persist 봉투

/**
 * 레거시 localStorage(인덱스 + 개별 키)에서 SOP 을 건져 올린 뒤 옛 키를 지운다.
 *
 * ADR-020 의 버전 리셋을 먼저 본다 — 옛 모양(content: string)이 서버로 올라가면
 * 되돌릴 방법이 없다. 버전이 낮으면 전부 폐기하고 빈 배열을 준다.
 */
export function absorbLegacySops(): Sop[] {
  if (typeof window === "undefined") return [];

  let ids: string[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(LEGACY_INDEX_KEY) ?? "[]") as string[];
  } catch {
    ids = [];
  }

  const stale = localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION;

  const absorbed: Sop[] = [];
  for (const id of ids) {
    if (!stale) {
      try {
        const raw = localStorage.getItem(legacyItemKey(id));
        if (raw) absorbed.push(JSON.parse(raw) as Sop);
      } catch {}
    }
    try {
      localStorage.removeItem(legacyItemKey(id));
    } catch {}
  }

  try {
    localStorage.removeItem(LEGACY_INDEX_KEY);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch {}

  return absorbed;
}

export const sops = createSyncedStore<Sop>({
  name: SOPS_KEY,
  endpoint: "/api/stores/sops",
  migrate: absorbLegacySops,
});

const { useStore } = sops;

export function useSopStorage() {
  sops.useSync();
  const list = useStore((s) => s.items);
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);

  const createSop = useCallback(
    (data: Omit<Sop, "id" | "createdAt" | "updatedAt">): Sop => {
      const now = new Date().toISOString();
      const sop: Sop = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...data };
      useStore.getState().add(sop);
      return sop;
    },
    [],
  );

  // 편집 계열은 전부 "현재 항목을 읽어 → 바꾼 뒤 → upsert" 로 같다.
  const patchSop = useCallback(
    (id: string, change: (existing: Sop) => Sop | null): void => {
      const existing = useStore.getState().items.find((s) => s.id === id);
      if (!existing) return;
      const next = change(existing);
      if (next) upsert({ ...next, updatedAt: new Date().toISOString() });
    },
    [upsert],
  );

  const updateSop = useCallback(
    (id: string, patch: Partial<Omit<Sop, "id" | "createdAt">>): void => {
      patchSop(id, (existing) => ({ ...existing, ...patch }));
    },
    [patchSop],
  );

  /** 단일 section upsert. data 가 비어있으면 자동으로 sections 에서 제거. */
  const setSection = useCallback(
    (id: string, section: SopSection): void => {
      patchSop(id, (existing) => {
        const others = existing.sections.filter((s) => s.type !== section.type);
        return { ...existing, sections: isSectionFilled(section) ? [...others, section] : others };
      });
    },
    [patchSop],
  );

  const clearSection = useCallback(
    (id: string, type: SopItemType): void => {
      patchSop(id, (existing) => {
        const next = existing.sections.filter((s) => s.type !== type);
        return next.length === existing.sections.length ? null : { ...existing, sections: next };
      });
    },
    [patchSop],
  );

  const deleteSop = useCallback((id: string): void => removeById(id), [removeById]);

  const getSop = useCallback(
    (id: string): Sop | undefined => useStore.getState().items.find((s) => s.id === id),
    [],
  );

  return { sops: list, createSop, updateSop, setSection, clearSection, deleteSop, getSop };
}
