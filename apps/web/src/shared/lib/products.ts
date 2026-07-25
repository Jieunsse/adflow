"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface ProductEntry {
  id: string;
  brandProfileId: string;
  name: string;
  description: string;
  imageUrl?: string;
  price?: string;
  targetUrl?: string;
  createdAt: number;
}

const useSupabase = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

function localKey(brandProfileId: string) {
  return `adflow:products:${brandProfileId}`;
}

function readLocal(brandProfileId: string): ProductEntry[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(brandProfileId)) ?? "[]") as ProductEntry[];
  } catch {
    return [];
  }
}

function writeLocal(brandProfileId: string, items: ProductEntry[]): void {
  try {
    localStorage.setItem(localKey(brandProfileId), JSON.stringify(items));
  } catch {}
}

export function useProducts(brandProfileId: string) {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const local = !useSupabase || browseMode;
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!brandProfileId) return;
    if (local) {
      setProducts(readLocal(brandProfileId));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/brand-profile/${brandProfileId}/products`);
      if (!res.ok) throw new Error("fetch failed");
      setProducts((await res.json()) as ProductEntry[]);
    } catch {
      setProducts(readLocal(brandProfileId));
    } finally {
      setLoading(false);
    }
  }, [brandProfileId, local]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (entry: ProductEntry, imageFile?: File): Promise<ProductEntry> => {
    if (local) {
      const all = readLocal(brandProfileId);
      const idx = all.findIndex((p) => p.id === entry.id);
      const next = idx >= 0 ? all.map((p, i) => (i === idx ? entry : p)) : [...all, entry];
      writeLocal(brandProfileId, next);
      setProducts(next.filter((p) => p.brandProfileId === brandProfileId));
      return entry;
    }
    const body = new FormData();
    body.append("data", JSON.stringify(entry));
    if (imageFile) body.append("image", imageFile);
    const isNew = !products.some((p) => p.id === entry.id);
    const res = await fetch(
      isNew
        ? `/api/brand-profile/${brandProfileId}/products`
        : `/api/brand-profile/${brandProfileId}/products/${entry.id}`,
      { method: isNew ? "POST" : "PUT", body }
    );
    if (!res.ok) throw new Error("저장 실패");
    const saved = (await res.json()) as ProductEntry;
    setProducts((prev) => {
      const i = prev.findIndex((p) => p.id === saved.id);
      return i >= 0 ? prev.map((p, idx) => (idx === i ? saved : p)) : [...prev, saved];
    });
    return saved;
  }, [brandProfileId, products, local]);

  const remove = useCallback(async (id: string): Promise<void> => {
    if (local) {
      const next = readLocal(brandProfileId).filter((p) => p.id !== id);
      writeLocal(brandProfileId, next);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    try {
      await fetch(`/api/brand-profile/${brandProfileId}/products/${id}`, { method: "DELETE" });
    } catch {}
    const next = readLocal(brandProfileId).filter((p) => p.id !== id);
    writeLocal(brandProfileId, next);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, [brandProfileId, local]);

  return { products, loading, save, remove, refresh };
}
