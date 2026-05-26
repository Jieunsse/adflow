"use client";

import { useCallback, useEffect, useState } from "react";
import { syncUpsert, syncDelete } from "@shared/lib/supabase-sync";

export interface PersonaEntry {
  id: string;
  brandProfileId: string;
  name: string;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  location?: string[];
  interests?: string[];
  customerDescription?: string;
}

const PERSONAS_KEY = "adflow:personas";

export function readPersonas(): PersonaEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PERSONAS_KEY) ?? "[]") as PersonaEntry[];
  } catch {
    return [];
  }
}

function persistPersonas(personas: PersonaEntry[]): void {
  try {
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(personas));
  } catch {}
}

export function usePersonasStorage() {
  const [personas, setPersonas] = useState<PersonaEntry[]>([]);

  useEffect(() => {
    setPersonas(readPersonas());
  }, []);

  const savePersona = useCallback((entry: PersonaEntry): void => {
    setPersonas((prev) => {
      const idx = prev.findIndex((p) => p.id === entry.id);
      const next = idx >= 0 ? prev.map((p, i) => (i === idx ? entry : p)) : [...prev, entry];
      persistPersonas(next);
      syncUpsert("persona", entry as unknown as Record<string, unknown>);
      return next;
    });
  }, []);

  const deletePersona = useCallback((id: string): void => {
    setPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistPersonas(next);
      syncDelete("persona", "id", id);
      return next;
    });
  }, []);

  return { personas, savePersona, deletePersona };
}

export function usePersonasForProfile(brandProfileId: string) {
  const [personas, setPersonas] = useState<PersonaEntry[]>([]);

  useEffect(() => {
    setPersonas(readPersonas().filter((p) => p.brandProfileId === brandProfileId));
  }, [brandProfileId]);

  const savePersona = useCallback(
    (entry: PersonaEntry): void => {
      setPersonas((prev) => {
        const idx = prev.findIndex((p) => p.id === entry.id);
        const next = idx >= 0 ? prev.map((p, i) => (i === idx ? entry : p)) : [...prev, entry];
        const all = readPersonas();
        const allIdx = all.findIndex((p) => p.id === entry.id);
        const allNext = allIdx >= 0 ? all.map((p, i) => (i === allIdx ? entry : p)) : [...all, entry];
        persistPersonas(allNext);
        syncUpsert("persona", entry as unknown as Record<string, unknown>);
        return next;
      });
    },
    [],
  );

  const deletePersona = useCallback((id: string): void => {
    setPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const all = readPersonas().filter((p) => p.id !== id);
      persistPersonas(all);
      syncDelete("persona", "id", id);
      return next;
    });
  }, []);

  return { personas, savePersona, deletePersona };
}
