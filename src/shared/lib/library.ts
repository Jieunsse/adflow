"use client";

// Library Entry — STEP 01 Creative 를 localStorage 에 영구 저장. 도메인 어휘는 .document/CONTEXT.md §Library Entry.
// 저장소 sync/hydrate 는 useScopedStorage primitive 가 담당. 여기선 도메인 형태(id 생성·prepend) 만.

import { useCallback, useMemo } from "react";
import { useScopedStorage } from "./storage/useScopedStorage";
import { syncDelete, syncUpsert } from "./supabase-sync";

const LIBRARY_KEY = "adflow_library_v1";

function newLibraryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "cre_" + crypto.randomUUID();
  }
  return "cre_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

export interface LibraryItem {
  id: string;
  savedAt: number;
  brand: string;
  headline: string;
  primary: string;
  tone: string;
  toneLabel: string;
  ctaId: string;
  ctaLabel: string;
  goal: string;
  target: string;
  gradient: string;
  tag: string;
}

export type NewLibraryItem = Omit<LibraryItem, "id" | "savedAt">;

export function useLibrary() {
  const [rawList, setList] = useScopedStorage<LibraryItem[]>("local", LIBRARY_KEY, []);

  const list = useMemo(() => {
    const seen = new Set<string>();
    return rawList.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }, [rawList]);

  const save = useCallback(
    (item: NewLibraryItem): string => {
      const id = newLibraryId();
      const entry = { id, savedAt: Date.now(), ...item };
      setList((prev) => [entry, ...prev]);
      syncUpsert("library_items", { id, saved_at: entry.savedAt, data: entry });
      return id;
    },
    [setList],
  );

  const remove = useCallback(
    (id: string) => {
      setList((prev) => prev.filter((x) => x.id !== id));
      syncDelete("library_items", "id", id);
    },
    [setList],
  );

  return { list, save, remove };
}
