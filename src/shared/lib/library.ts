"use client";

import { useCallback, useEffect, useState } from "react";

const LIBRARY_KEY = "adflow_library_v1";
const LIBRARY_EVENT = "adflow:library";

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

function readLibrary(): LibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]") as LibraryItem[];
  } catch {
    return [];
  }
}

function writeLibrary(list: LibraryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(LIBRARY_EVENT));
}

export function useLibrary() {
  const [list, setList] = useState<LibraryItem[]>([]);

  useEffect(() => {
    const sync = () => setList(readLibrary());
    sync();
    window.addEventListener(LIBRARY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LIBRARY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((item: NewLibraryItem): string => {
    const id = "cre_" + Math.random().toString(36).slice(2, 10);
    writeLibrary([{ id, savedAt: Date.now(), ...item }, ...readLibrary()]);
    return id;
  }, []);

  const remove = useCallback((id: string) => {
    writeLibrary(readLibrary().filter((x) => x.id !== id));
  }, []);

  return { list, save, remove };
}
