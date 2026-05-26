"use client";

import { useCallback, useEffect, useState } from "react";
import { syncDelete, syncUpsert } from "@shared/lib/supabase-sync";

export type SopItemType =
  | "prohibited_words"
  | "length_limits"
  | "cta_restrictions"
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

export interface FreeTextData {
  text: string;
}

export type FreeTextSopType =
  | "industry_regulations"
  | "competitor_policy"
  | "pricing_rules"
  | "audience_restrictions"
  | "platform_rules";

export type SopSection =
  | { type: "prohibited_words"; data: ProhibitedWordsData; source?: SopSectionSource }
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

const INDEX_KEY = "adflow:sop-index";
const itemKey = (id: string) => `adflow:sop:${id}`;
const VERSION_KEY = "adflow:sop:version";
const CURRENT_VERSION = "2";

export function isSectionFilled(s: SopSection): boolean {
  switch (s.type) {
    case "prohibited_words":
      return s.data.words.length > 0;
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

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {}
}

function readSop(id: string): Sop | null {
  try {
    const raw = localStorage.getItem(itemKey(id));
    return raw ? (JSON.parse(raw) as Sop) : null;
  } catch {
    return null;
  }
}

function writeSop(sop: Sop): void {
  try {
    localStorage.setItem(itemKey(sop.id), JSON.stringify(sop));
  } catch {}
  syncUpsert("sops", {
    id: sop.id,
    name: sop.name,
    description: sop.description ?? null,
    sections: sop.sections,
    created_at: sop.createdAt,
    updated_at: sop.updatedAt,
  });
}

function deleteSopFromStorage(id: string): void {
  try {
    localStorage.removeItem(itemKey(id));
  } catch {}
  syncDelete("sops", "id", id);
}

/**
 * v0.6 schema bump (ADR-020).
 * v1/v0.5 entries (`content: string` 모양) 를 전부 폐기. 자동 변환 X — 실유저 데이터 없음 전제.
 * 멱등 — `adflow:sop:version === '2'` 면 no-op.
 */
function runVersionReset(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(VERSION_KEY) === CURRENT_VERSION) return;
  const ids = readIndex();
  for (const id of ids) {
    try {
      localStorage.removeItem(itemKey(id));
    } catch {}
  }
  writeIndex([]);
  try {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch {}
}

export function useSopStorage() {
  const [sops, setSops] = useState<Sop[]>([]);

  useEffect(() => {
    runVersionReset();
    const ids = readIndex();
    setSops(ids.map((id) => readSop(id)).filter(Boolean) as Sop[]);
  }, []);

  const createSop = useCallback(
    (data: Omit<Sop, "id" | "createdAt" | "updatedAt">): Sop => {
      const now = new Date().toISOString();
      const sop: Sop = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      writeSop(sop);
      const ids = [sop.id, ...readIndex()];
      writeIndex(ids);
      setSops((prev) => [sop, ...prev]);
      return sop;
    },
    [],
  );

  const updateSop = useCallback(
    (id: string, patch: Partial<Omit<Sop, "id" | "createdAt">>): void => {
      const existing = readSop(id);
      if (!existing) return;
      const updated: Sop = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      writeSop(updated);
      setSops((prev) => prev.map((s) => (s.id === id ? updated : s)));
    },
    [],
  );

  /** 단일 section upsert. data 가 비어있으면 자동으로 sections 에서 제거. */
  const setSection = useCallback((id: string, section: SopSection): void => {
    const existing = readSop(id);
    if (!existing) return;
    const others = existing.sections.filter((s) => s.type !== section.type);
    const next = isSectionFilled(section) ? [...others, section] : others;
    const updated: Sop = {
      ...existing,
      sections: next,
      updatedAt: new Date().toISOString(),
    };
    writeSop(updated);
    setSops((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const clearSection = useCallback((id: string, type: SopItemType): void => {
    const existing = readSop(id);
    if (!existing) return;
    const next = existing.sections.filter((s) => s.type !== type);
    if (next.length === existing.sections.length) return;
    const updated: Sop = {
      ...existing,
      sections: next,
      updatedAt: new Date().toISOString(),
    };
    writeSop(updated);
    setSops((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const deleteSop = useCallback((id: string): void => {
    deleteSopFromStorage(id);
    const ids = readIndex().filter((i) => i !== id);
    writeIndex(ids);
    setSops((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getSop = useCallback((id: string): Sop | undefined => {
    return readSop(id) ?? undefined;
  }, []);

  return { sops, createSop, updateSop, setSection, clearSection, deleteSop, getSop };
}
